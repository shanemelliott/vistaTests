var axios = require('axios');
const fastcsv = require('fast-csv');
const fs = require('fs');
var parse = require('csv-parse');
const { exit } = require('process');
const config = require('./config');

const cliProgress = require('cli-progress');
const bar1 = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);

process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

async function getToolMenu(stationNo, duz) {
  try {
    // First request to get the token
    const tokenResponse = await axios.post(
      config.VistaApiX.tokenUrl,
      {
        "key": config.KeyX
      }
    );

    // Extract the token from the response
    const token = tokenResponse.data.data.token;

    // Second request using the token
    const toolMenuResponse = await axios.post(
      config.VistaApiX.url + '/vista-sites/' + stationNo + '/users/' + duz + '/rpc/invoke',
      {
        "context": "OR CPRS GUI CHART",
        "rpc": "ORWU TOOLMENU",
        "jsonResult": false,
        "parameters": []
      },
      {
        headers: {
          'authorization': 'Bearer ' + token
        }
      });

    // Extract and return the payload from the response
    return toolMenuResponse.data.payload;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

function getStations() {
  return new Promise(function (resolve, reject) {
    var stations = []
    fs.createReadStream("accounts.csv")
      .pipe(parse.parse({ delimiter: ',' }))
      .on('data', function (csvrow) {
        var row = {
          "stationNo": csvrow[0],
          "accountDuz": csvrow[1],
        }
        stations.push(row)
      })
      .on('end', () => resolve(stations));
  })
}

const entryPoint = async () => {

  const ws = fs.createWriteStream("results.csv");

  const csvStream = fastcsv.format({ headers: true, includeEndRowDelimiter: true });
  csvStream.pipe(ws);

  try {
    var stations = await getStations()
  }
  catch (error) {
    console.error(error);
    throw error;
  };

  bar1.start(stations.length, 0);

  try {
    for (const station of stations) {

      var toolmenu = await getToolMenu(station.stationNo, station.accountDuz);

      csvStream.write({ stationNo: station.stationNo, toolmenuJSON: JSON.stringify(toolmenu) })

      bar1.increment();

    }
  }
  catch (error) {
    console.error(error)
  }

  bar1.stop();

  csvStream.end();
  ws.close();

}

entryPoint()






