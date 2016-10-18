/* eslint-disable */
const page = require('webpage').create();
const system = require('system');
const fs = require('fs');

phantom.onError = function(msg, trace) {
  var msgStack = ['PHANTOMJS ERROR: ' + msg];
  if (trace && trace.length) {
    msgStack.push('TRACE:');
    trace.forEach(function(t) {
      msgStack.push(' -> ' + (t.file || t.sourceURL) + ': ' + t.line + (t.function ? ' (in function ' + t.function +')' : ''));
    });
  }
  console.error(msgStack.join('\n'));
  phantom.exit(1);
};


console.log('Starting report server');
console.log('Using PhantomJS version ' +
    phantom.version.major + '.' +
    phantom.version.minor + '.' +
    phantom.version.patch
);
console.log('Agent details: ' +
    page.settings.userAgent
);

if (system.args.length < 2) {
  console.log('Usage: reportServer.js <data file> [<output file> <dist folder> <portrait/landscape> <resourceTimeout> <type>]');
  phantom.exit(1);
}

var dataFile = system.args[1];
var outputFile = system.args[2];
var distDir = system.args[3];
var orientation = system.args[4];
var resourceTimeout = system.args[5];
var reportType = system.args[6] || 'pdf';

page.settings.resourceTimeout = resourceTimeout ? Number(resourceTimeout) : 50;

const distFolder = distDir || (fs.absolute(".") + '/dist');

const indexHtml = fs.read(distFolder + '/index.html');
const afterTypeReplace = indexHtml.replace('\'{report-type}\'', JSON.stringify(reportType));

const loadedData = fs.read(dataFile);

// $ is a special character in string replace, see here: https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/String/replace#Specifying_a_string_as_a_parameter
const finalHtmlData = afterTypeReplace.replace('\'{report-data-to-replace}\'', loadedData.replace(/\$/g, '$$$$'));

const date = Date.now();

const tmpReportName = outputFile ? (outputFile.substring(outputFile.lastIndexOf('/'), outputFile.lastIndexOf('.')) + '.html') : 'reportTmp-' + date + '.html';
fs.write(distFolder + '/' + tmpReportName, finalHtmlData, 'w');

console.log('HTML template was created: ' + distFolder + '/' + tmpReportName);

var baseUrl = distFolder.indexOf('/') === 0 ? distFolder : fs.absolute(".") + '/' + distFolder;

try {
  page.open('file://' + baseUrl + '/' + tmpReportName, function (status) {
    console.log("Read report page status: " + status);

    if (status === "success") {
      switch (reportType) {
        case 'pdf':
          page.paperSize = {
            format: 'letter', // 'A3', 'A4', 'A5', 'Legal', 'Letter', 'Tabloid'
            orientation: orientation || 'portrait', // portrait / landscape
            margin: {
              top: "1cm",
              bottom: "1cm"
            }
          };

          setTimeout(function () {
            if (page.render(outputFile || distFolder + '/report-' + date + '.pdf', { quality: 100 })) {
              console.log("PDF report was generated successfully.");
              try {
                fs.remove(distFolder + '/' + tmpReportName);
              } catch (ignored) {
                // do nothing
              }
            } else {
              console.log("Failed to generate PDF report.");
            }
            phantom.exit();
          }, 5000);

          break;
        case 'csv':
          var csvData = page.evaluate(function() {
            return document.csvData;
          });
          if (csvData) {
            fs.write(outputFile || distFolder + '/report-' + date + '.csv', csvData, 'w');
            console.log("CSV report was generated successfully.");
          } else {
            console.log("Failed to generate CSV report.");
          }
          phantom.exit();
          break;
      }
    } else {
      console.log("Cannot open report page.");
      phantom.exit(1);
    }
  });
} catch (ex) {
  console.log("Error when opening html report: " + ex);
  phantom.exit(1);
}
