var pathToCSV = __dirname + "/files/calendar.csv";
var meeting_block_finder = require('./src/meeting_block');
meeting_block_finder.getLargestOpenBlockFromCSV(pathToCSV);
