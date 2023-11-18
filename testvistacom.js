var axios = require('axios');
const fastcsv = require('fast-csv');
const fs = require('fs');
var parse = require('csv-parse');
const config = require('./config.dev');
const cliProgress = require('cli-progress');
const bar1 = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);

const accountsFile = "accounts-tests.csv"

process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;
function getComInfo(stationNo, duz) {

  return new Promise(function (resolve, reject) {
    axios.post(config.vistaApi.tokenUrl,
      {
        "key": config.key,
      }).then(function (data) {
        axios.post(config.vistaApi.url.replace('{stationNo}', stationNo).replace('{duz}', duz),
          {

              "context": "OR CPRS GUI CHART",
              "rpc": "ORWCOM GETOBJS", //"ORWCOM GETOBJS",
              "jsonResult": false,
              "parameters" : []

          }, { headers: { 'authorization': 'Bearer ' + data.data.data.token }, }
        ).then(function (data) {
          var jsonData = data.data;
          console.log("Payload" + JSON.stringify(data.data.payload))
          var resp = jsonData.payload
          if (resp) {
            var respArr = resp.split(/\r?\n/);
            var dataArr = []
            respArr.forEach(function (e) {
              var rec = e.split("^")
              if (rec.length > 1)
                rec.push(stationNo)
              dataArr.push(rec)
            })
            //console.log(dataArr)
            resolve(dataArr)
          }
        })
        .catch((err) => {
          console.error(err.response.data);
        });
      })
      .catch((err) => {
        console.error(err);

      });
  })
}
function getStations() {
  return new Promise(function (resolve, reject) {
    var stations = []
    fs.createReadStream(accountsFile)
      .pipe(parse.parse({ delimiter: ',' }))
      .on('data', function (csvrow) {
        var row = {
          "stationNo": csvrow[0],
          "accountDuz": csvrow[1]
        }
        stations.push(row)
      })
      .on('end', () => resolve(stations));


  })
}
var comRes = []
function addRes(comInfo) {
  comRes.push(...comInfo)
}

const doConfig = async () => {

  try {
    var stations = await getStations()
    // console.log("Stations: ", stations);
    bar1.start(stations.length, 0);
    for (var i = 0; i < stations.length; i++) {
      var comInfo = await getComInfo(stations[i].stationNo, stations[i].accountDuz)
      console.log("comInfo: ", comInfo)
      if (comInfo) {
        addRes(comInfo)
      } else {
        console.log("No results")
      }
      bar1.increment()
    }
  }
  catch (error) {
    console.error(error)
    error_log(error)
  }
  const ws = fs.createWriteStream("results.csv");
  fastcsv
    .write(comRes, { headers: false })
    .pipe(ws);
  bar1.stop();
}
doConfig()






