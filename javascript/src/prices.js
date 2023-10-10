const express = require('express')
const mysql = require('mysql2/promise')

async function createApp() {
    const app = express()

    let connection;
    try {
        if (process.env.NODE_ENV === 'test') {
            const {MySqlContainer} = require("@testcontainers/mysql")
            const filePath = require('path').resolve(__dirname, '../../database')
            let container = await new MySqlContainer("mysql:8.0.31")
                .withDatabase("lift_pass")
                .withRootPassword('password')
                .withBindMounts([{source: filePath, target: "/docker-entrypoint-initdb.d"}])
                .withReuse()
                .start()
            const port = container.getMappedPort(3306);
            const host = container.getHost();
            console.info(`started test container on ${host}:${port}`)
            const  connectionOptions = {
                host,
                port,
                user: 'root',
                password: 'password',
                database: 'lift_pass'
            }
            connection = await mysql.createConnection(connectionOptions);
        } else {
            require('dotenv').config();

            let connectionOptions = {
                host: 'localhost',
                user: process.env.DB_USER,
                database: process.env.DB_DATABASE,
                password: process.env.DB_PASSWORD
            };

            connection = await mysql.createConnection(connectionOptions);
        }
    } catch (error) {
        console.error("Failed to start DB", error);
        throw error;
    }

    app.put('/prices', async (req, res) => {
        const liftPassCost = req.query.cost
        const liftPassType = req.query.type
        const [rows, fields] = await connection.query(
            'INSERT INTO `base_price` (type, cost) VALUES (?, ?) ' +
            'ON DUPLICATE KEY UPDATE cost = ?',
            [liftPassType, liftPassCost, liftPassCost]);

        res.json()
    })

    app.get('/prices', async (req, res) => {
        const result = (await connection.query(
            'SELECT cost FROM `base_price` ' +
            'WHERE `type` = ? ',
            [req.query.type]))[0][0]

        if (req.query.age < 6) {
            res.json({cost: 0})
        } else {
            if (req.query.type !== 'night') {
                const holidays = (await connection.query(
                    'SELECT * FROM `holidays`'
                ))[0]

                let isHoliday;
                let reduction = 0
                for (let row of holidays) {
                    let holiday = row.holiday
                    if (req.query.date) {
                        let d = new Date(req.query.date)
                        if (d.getFullYear() === holiday.getFullYear()
                            && d.getMonth() === holiday.getMonth()
                            && d.getDate() === holiday.getDate()) {

                            isHoliday = true
                        }
                    }

                }

                if (!isHoliday && new Date(req.query.date).getDay() === 1) {
                    reduction = 35
                }

                // TODO apply reduction for others
                if (req.query.age < 15) {
                    res.json({cost: Math.ceil(result.cost * .7)})
                } else {
                    if (req.query.age === undefined) {
                        let cost = result.cost * (1 - reduction / 100)
                        res.json({cost: Math.ceil(cost)})
                    } else {
                        if (req.query.age > 64) {
                            let cost = result.cost * .75 * (1 - reduction / 100)
                            res.json({cost: Math.ceil(cost)})
                        } else {
                            let cost = result.cost * (1 - reduction / 100)
                            res.json({cost: Math.ceil(cost)})
                        }
                    }
                }
            } else {
                if (req.query.age >= 6) {
                    if (req.query.age > 64) {
                        res.json({cost: Math.ceil(result.cost * .4)})
                    } else {
                        res.json(result)
                    }
                } else {
                    res.json({cost: 0})
                }
            }
        }
    })

    return {app, connection}
}

module.exports = {createApp}