import { envs, hyperengageClient } from "../src/hyperengage"
import { HyperengageClient } from "../src/interface";
import fs from "fs"
import express from 'express'
import bodyParser from 'body-parser';
import * as core from "express-serve-static-core"
import * as nodeFetch from "cross-fetch";
const fetchCookieDecorator = require('fetch-cookie');


/**
 * This test verifies that Hyperengage SDK works well with Node.js and Express environment.
 *
 * It spins a test server, and sends event to fake hyperengage host through this server.
 */

let testServer = null;

const fetchLog = [];
const fetchMock = (...args) => {
  const [url, ...params] = args;
  console.log("Called fetch with", args);
  fetchLog.push({url: url, params: [...params]});
  return Promise.resolve({status: 200, json: () => Promise.resolve({}), text: () => Promise.resolve("{}")});
};

async function createTestServer()  {
  const app = express();
  app.use(bodyParser.json())
  app.use(bodyParser.text())
  app.get('/test/page', async (req: core.Request, res: core.Response) => {
    let hyperengage: HyperengageClient = hyperengageClient({
      fetch: fetchMock,
      key: "Test",
      workspace_key: "sdfdfdfds",
      tracking_host: "https://test-host.com",
      max_send_attempts: 1,
    });
    console.log('Processed. Sending data to Hyperengage')
    try {
      await hyperengage.account({account_id: '1234', traits: {name:"Segment"}}, true)
      await hyperengage.user({user_id: '1212', traits: {name:"Zeeshan", email: 'zeeshan@123.com'}}, true)
      await hyperengage.track('page_view', {properties: {test: 1}, env: envs.express(req, res)});
      res.status(200).send({status: 'ok'});
    } catch (e) {
      console.log(e);
      console.error("Hyperengage track failed!", e)
      res.status(500).send({status: 'error'});
    }
  })
  testServer = await listen(app);
}

function listen(app: core.Express): Promise<any> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      (server.address() as any).port
      resolve(server);
    })
  })
}



beforeAll(async () => {
  await createTestServer();
  console.log('Test server started on ' + testServer.address().port)
});

afterAll(() => {
  if (testServer) {
    testServer.close();
  }
})

test("Test Hyperengage Client npm only", async () => {
  fetchLog.length = 0
  const _fetch = fetchCookieDecorator(nodeFetch.default)
  let testResult = await _fetch(`http://localhost:${testServer.address().port}/test/page?utm_source=1&gclid=2`);
  expect(testResult.status).toBe(200)
  expect(fetchLog.length).toBe(1)
  let body = JSON.parse(fetchLog[0].params[0].body)
  console.log("Hyperengage Track Payload", body);
  const userId = body?.anonymous_id
  expect(userId).toBeDefined()
  expect(body?.doc_search).toBe('?utm_source=1&gclid=2')
  expect(body?.url?.indexOf('http://')).toBe(0)
  expect(body?.utm?.source).toBe("1")
  expect(body?.click_id?.gclid).toBe("2")
  fetchLog.length = 0;

  let testResult2 = await _fetch(`http://localhost:${testServer.address().port}/test/page`);
  expect(testResult2.status).toBe(200)
  expect(fetchLog.length).toBe(1)
  body = JSON.parse(fetchLog[0].params[0].body)
  expect(body?.properties.test).toBe(1)
  expect(body?.anonymous_id).toBe(userId)
  expect(body?.doc_search).toBe('');
  expect(body?.user_id).toBe('1212')
  expect(body?.account_id).toBe('1234')
});
