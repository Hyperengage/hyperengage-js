/**
 * @jest-environment jsdom
 *
 * DO NOT DELETE LINE ABOVE, THIS IS AN INSTRUCTION FOR JEST
 *
 * This test suite verifies that Hyperengage works as a npm package with DOM
 * env
 */

import { envs, hyperengageClient } from "../src/hyperengage";
import { HyperengageClient } from "../src/interface";
import { sleep, waitFor } from "./common/common";

type RequestCache = {
  url: string;
  headers: Record<string, string>;
  payload: string;
};

const requestLog: RequestCache[] = [];

let mockDisabled = false

class XHRMock {
  private url: string;
  private headers = {};
  private onload: any
  private onerror: any
  private status: number

  constructor() {}

  open(url: string) {
    this.url = url;
  }

  setRequestHeader(name: string, val: string) {
    this.headers[name.toLocaleLowerCase()] = val;
  }

  send(payload) {
    if (mockDisabled) {
      this.status = 403
      if (this.onerror) {
        this.onerror()
      }

      return
    }

    payload = JSON.parse(payload)
    if (Array.isArray(payload)) {
      payload.forEach(event =>
        requestLog.push({ url: this.url, headers: this.headers, payload: JSON.stringify(event) }))
    } else {
      requestLog.push({ url: this.url, headers: this.headers, payload: JSON.stringify(payload) });
    }

    this.status = 200;
    if (this.onload) {
      this.onload()
    }
  }
}

beforeEach(() => {
  requestLog.length = 0
  mockDisabled = false
  localStorage.clear()
})

beforeAll(() => {
  // @ts-ignore
  window.XMLHttpRequest = XHRMock;
});

test("test browser with retries", async () => {
  mockDisabled = true
  let hyperengage: HyperengageClient = hyperengageClient({
    key: "Test",
    workspace_key: "123",
    tracking_host: "https://test-host.com",
    custom_headers: () => ({
      "test1": "val1",
      "test2": "val2"
    }),
    max_send_attempts: 100000,
    min_send_timeout: 10,
    max_send_timeout: 10,
  });

  await hyperengage.identify_user({ traits: {email: "john.doe@gmail.com", name: 'Zeeshan'}, user_id: "1212" });
  await hyperengage.track("page_view", { properties: {test: 1} });

  await sleep(500)
  mockDisabled = false

  await waitFor(() => requestLog.length === 2, 1000)

  console.log("Requests", requestLog)
  const event1 = JSON.parse(requestLog[0].payload)
  const event2 = JSON.parse(requestLog[1].payload)

  expect(requestLog[0].headers?.test1).toBe("val1")
  expect(requestLog[0].headers?.test2).toBe("val2")

  expect(event1?.anonymous_id).toBe(event2?.anonymous_id)
  expect(event1?.traits.email).toBe('john.doe@gmail.com')
  expect(event2?.properties.test).toBe(1)
  expect(event1?.user_id).toBe('1212')
  expect(event2?.user_id).toBe('1212')
  expect(event1.event_type).toBe('user_identify')
  expect(event2.event_type).toBe('page_view')
});

test("test browser sync", async () => {
  let counter = 0
  let hyperengage: HyperengageClient = hyperengageClient({
    key: "Test",
    workspace_key: "1234",
    tracking_host: "https://test-host.com",
    custom_headers: () => ({
      "test1": "val1",
      "test2": "val" + (counter++)
    }),
    max_send_attempts: 1
  });
  await hyperengage.identify_user({ traits: {name:'zizou', email: "john.doe@gmail.com"}, user_id: "1212" });
  await hyperengage.track("page_view", {properties: { test: 1 }});
  expect(requestLog.length).toBe(2)
  console.log("Requests", requestLog)
  const event1 = JSON.parse(requestLog[0].payload)
  const event2 = JSON.parse(requestLog[1].payload)

  expect(requestLog[0].headers?.test2).toBe("val0")
  expect(requestLog[1].headers?.test2).toBe("val1")

  expect(requestLog[0].headers?.test1).toBe("val1")
  expect(requestLog[1].headers?.test1).toBe("val1")

  expect(event1?.anonymous_id).toBe(event2?.anonymous_id)
  expect(event1?.traits.email).toBe('john.doe@gmail.com')
  expect(event2?.properties.test).toBe(1)
  expect(event1?.user_id).toBe('1212')
  expect(event2?.user_id).toBe('1212')
  expect(event1.event_type).toBe('user_identify')
  expect(event2.event_type).toBe('page_view')
});

test("test browser max attempts exceeded", async () => {
  mockDisabled = true
  let hyperengage: HyperengageClient = hyperengageClient({
    key: "Test",
    workspace_key: "zeeshhi",
    tracking_host: "https://test-host.com",
    custom_headers: () => ({
      "test1": "val1",
      "test2": "val2"
    }),
    max_send_attempts: 3,
    min_send_timeout: 10,
    max_send_timeout: 10,
  });

  await hyperengage.identify_user({ traits: {email: "john.doe@gmail.com", name: "zeeshi"}, user_id: "1212" });
  await sleep(500)
  mockDisabled = false

  await hyperengage.track("page_view", { properties: {test: 1} });

  await waitFor(() => requestLog.length === 1, 1000)


  console.log("Requests", requestLog)
  const event2 = JSON.parse(requestLog[0].payload)

  expect(requestLog[0].headers?.test1).toBe("val1")
  expect(requestLog[0].headers?.test2).toBe("val2")

  expect(event2?.user_id).toBe('1212')
  expect(event2.event_type).toBe('page_view')
});
