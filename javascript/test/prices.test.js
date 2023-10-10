const { createApp } = require("../src/prices");
const request = require("supertest");

jest.setTimeout(30000)

describe('prices', () => {

    let app, connection

    beforeEach(async () => {
        ({app, connection} = await createApp())
    });

    afterEach(function () {
        connection.end()
    });

    it('does something', async () => {
        const response = await request(app)
            .get('/prices?type=1jour')

        const expectedResult = {cost: 35} // change this to make the test pass
        expect(response.body).toEqual(expectedResult)    
    })    
})