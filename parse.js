import { readFileSync, writeFileSync } from "fs";
import { argv, exit } from "process";

if (argv.length !== 3) {
  console.error(`Usage: ${argv[0]} ${argv[1]} <HAR filename>`);
  exit(1);
}

function maskApexRemoteRequestDetails(request) {
  request.data = "...";
  request.ctx = "...";
}

function maskApexRemoteResponseDetails(request) {
  request.result = "...";
}

const filename = argv[2];
const data = readFileSync(filename);
const har = JSON.parse(data.toString());

const entries = har.log.entries;

const result = [];
const count = {};

function increaseMethodCount(request, wait) {
  const method = `${request.action}::${request.method}`;
  if (method in count) {
    count[method].count = count[method].count + 1;
    count[method].cumulativeWait = count[method].cumulativeWait + wait; 
  } else {
    count[method] = {
        count: 1,
        cumulativeWait: wait
    };
  }
}
for (const entry of entries) {
  const details = {
    wait: entry.timings.wait,
    method: entry.request.method,
    url: entry.request.url,
    response: {
        size: entry.response.content.size,
        mimeType: entry.response.content.mimeType,
        status: entry.response.status,
        statusText: entry.response.statusText,
    }
  };
  if (entry.request.url.match(/\/apexremote$/i)) {
    details.apexRemote = {
      request: JSON.parse(entry.request.postData.text),
      response: JSON.parse(entry.response.content.text),
      responseSize: entry.response.content.size,
      multipleRequests: false,
    };
    if (Array.isArray(details.apexRemote.response)) {
      for (const response of details.apexRemote.response) {
        maskApexRemoteResponseDetails(response);
      }
    } else {
      maskApexRemoteResponseDetails(details.apexRemote.response);
    }
    if (Array.isArray(details.apexRemote.request)) {
      details.apexRemote.multipleRequests = true;
      for (const request of details.apexRemote.request) {
        maskApexRemoteRequestDetails(request);
        increaseMethodCount(request, entry.timings.wait);
      }
    } else {
      maskApexRemoteRequestDetails(details.apexRemote.request);
      increaseMethodCount(details.apexRemote.request, entry.timings.wait);
    }
  }
  result.push(details);
}
const outputFilename = `${filename}.json`;
console.log(`Write ${result.length} entries to ${outputFilename}`);

writeFileSync(
  outputFilename,
  JSON.stringify(
    {
      entries: result,
      count: count,
    },
    null,
    2
  )
);
