var moment = require('moment');
var csvToArr = require('csv-to-array');
const IS_START_OF_INTERVAL = "S";
const IS_END_OF_INTERVAL = "E";
const NO_BLOCKS_OPEN = "NO_BLOCKS_OPEN";
const COLOUMNS = ["userID", "start", "end"];
const ERR_Invalid_Interval_Kind = "Invalid_Interval_Kind";
const ERR_End_Time_Greater_Start_Time = "End_Time_Cannot_Be_Greater_Than_Start_Time";

function getLargestOpenBlockFromCSV(path){
    readCSVData(path)
        .then((csvArr)=>{
            var arrayOfIntervals1 = distributeEndStartTimes(csvArr);
            var formatedMeetings = formatAndFilterMeetings(arrayOfIntervals1);
            var intervalArr = findOpenIntervals(formatedMeetings);
            var biggestBlockofSpace1 = getBiggestBlockOpenWithinHours(intervalArr);
            var formattedBlockProperties = {
                openDuration: biggestBlockofSpace1.openTime,
                startTime: moment.unix(biggestBlockofSpace1.start).format(),
                endTime: moment.unix(biggestBlockofSpace1.end).format()
            }

            if(formattedBlockProperties.openDuration == 0){
                console.log(`There were no good open blocks with everyone's schedule open`);
            }else{
                console.log(`Biggest Open Time Was ${formattedBlockProperties.openDuration} seconds from ${formattedBlockProperties.startTime} to ${formattedBlockProperties.endTime}`);
            }

        },(err) => {
            console.log("Something went wrong while reading CSV");
            console.log(err);
        })
}

function readCSVData(path){
    return new Promise((resolve, reject)=>{
        csvToArr({
            file: path,
            columns: COLOUMNS
        }, (err, csvArr) => {
            if(err != null){ reject(err); }
            else{ resolve(csvArr); }
        })
    })
}


function distributeEndStartTimes(csvArr){
    var arrayOfIntervals = [];
    csvArr.forEach((meeting) => {
        var startTime = moment(meeting.start);
        var endTime = moment(meeting.end);
        var now = moment();
        var OneWeekStartDayFromNow = now.add(1, 'weeks').endOf('day').unix()
        var startUnixTime = moment(meeting.start).unix();
        var endUnixTime = moment(meeting.end).unix();

        if(startTime < now && endTime >= now ){
            startUnixTime = now.unix();
        }

        if(startTime <= OneWeekStartDayFromNow && endTime > OneWeekStartDayFromNow ){
            endUnixTime = moment().add(1, 'weeks').set('hour', 22).set('minute', 0).set('second', 0).unix();
        }

        arrayOfIntervals.push({intervalKind:IS_START_OF_INTERVAL, time:startUnixTime});
        arrayOfIntervals.push({intervalKind:IS_END_OF_INTERVAL, time:endUnixTime});
    })

    return arrayOfIntervals;
}


function formatAndFilterMeetings(meetingsArr){
    var startCalender = moment().unix();
    var endCalender = moment().add(1, 'weeks').endOf('day').unix();

    //filter out meetings that are not within our timeline (now to a week)
    meetingsArr = meetingsArr.filter((obj) => {
        return ( (obj.time >= startCalender) && (obj.time <= endCalender) );
    });

    //push these so that we can indicate that an open interval can be taken between these points
    meetingsArr.push({time:startCalender, intervalKind:"S"},{time:startCalender, intervalKind:"E"});
    meetingsArr.push({time:endCalender, intervalKind:"S"},{time:endCalender, intervalKind:"E"});

    //sort the array with its time. we can then use this to find open-intervals in between meetings later.
    meetingsArr = meetingsArr.sort((point1, point2) => {
        if(point1.time == point2.time){
            if(point1.intervalKind == IS_START_OF_INTERVAL && point2.intervalKind == IS_END_OF_INTERVAL){
                return -1;
            }else if(point2.intervalKind == IS_START_OF_INTERVAL && point1.intervalKind == IS_END_OF_INTERVAL){
                return 1;
            }
        }
        return point1.time - point2.time;
    });

    return meetingsArr;
}


function findOpenIntervals(meetingIntervalArr){
    var arrOfOpenTime = [];
    var wasJustOpenInterval = false;
    var openIntervalObj = {};

    var howManyIntervalsCurrently = 0;

    meetingIntervalArr.forEach((intervalPoint) => {
        if(intervalPoint.intervalKind == IS_START_OF_INTERVAL){
            howManyIntervalsCurrently++;
            if(wasJustOpenInterval){
                wasJustOpenInterval = false;
                openIntervalObj.end = intervalPoint.time;
                openIntervalObj.openTime = moment.unix(openIntervalObj.end).diff(moment.unix(openIntervalObj.start)); //in seconds
                arrOfOpenTime.push(openIntervalObj);
                openIntervalObj = {};
            }
        }else if(intervalPoint.intervalKind == IS_END_OF_INTERVAL){
            howManyIntervalsCurrently--;
        }else{
            console.log("Invalid_Interval_Kind");
            throw new Error(ERR_Invalid_Interval_Kind);
        }

        if(howManyIntervalsCurrently == 0){
            wasJustOpenInterval = true;
            openIntervalObj.start = intervalPoint.time;
        }

    })


    return arrOfOpenTime;
}


function getBiggestBlockOpenWithinHours(arrayOfOpenTime){
    var biggestTimeBlockOpen = NO_BLOCKS_OPEN;

    arrayOfOpenTime.forEach((obj) => {

        //if not on the same day, figure out which open-spot bigger on each day
        if(moment.unix(obj.start).date() != moment.unix(obj.end).date()){
            obj = multipleDaysBlockCorrector(obj);
        }

        if(!(moment.unix(obj.start).hours() < 8 && moment.unix(obj.end).hours() < 8)){
            if(!(moment.unix(obj.start).hours() > 22 && moment.unix(obj.end).hours() > 22)){

                if(moment.unix(obj.start).hours() < 8){
                    obj.start = moment.unix(obj.start).set('hour', 8).set('minute', 0).set('second', 0).unix();
                }

                if(moment.unix(obj.end).hours() > 22){
                    obj.end = moment.unix(obj.end).set('hour', 22).set('minute', 0).set('second', 0).unix();
                }

                obj.openTime = moment.unix(obj.end).diff(moment.unix(obj.start)); //in seconds
                if(biggestTimeBlockOpen == NO_BLOCKS_OPEN || biggestTimeBlockOpen.openTime <= obj.openTime){
                    biggestTimeBlockOpen = obj;
                }
            }
        }
    })

    return biggestTimeBlockOpen;
}



function multipleDaysBlockCorrector(block){
    if(moment.unix(block.end).startOf('day').diff(moment.unix(block.start).startOf('day'),'days') > 1){
        //If we have an empty day, make that the biggest spot
        block.start = moment.unix(block.start).add(1, 'days').set('hour', 8).set('minute', 0).set('second', 0).unix();
        block.end   = moment.unix(block.start).set('hour', 22).set('minute', 0).set('second', 0).unix();

    }else if(moment.unix(block.end).startOf('day').diff(moment.unix(block.start).startOf('day'),'days') == 1){
         // if no empty days in between
        var tempStart = block.start;
        var tempEnd = block.end;

        if(moment.unix(block.start).hours() < 8){
            tempStart= moment.unix(block.start).set('hour', 8).set('minute', 0).set('second', 0).unix();
        }else if(moment.unix(block.start).hours() > 22){
            tempStart = moment.unix(block.start).set('hour', 22).set('minute', 0).set('second', 0).unix();
        }

        if(moment.unix(block.end).hours() < 8){
            tempEnd = moment.unix(block.end).set('hour', 8).set('minute', 0).set('second', 0).unix();
        }else if(moment.unix(block.start).hours() > 22){
            tempEnd = moment.unix(block.end).set('hour', 22).set('minute', 0).set('second', 0).unix();
        }

        var openTimeInOpenDay = 22 - moment.unix(tempStart).hours();
        var openTimeInEndDay = moment.unix(tempEnd).hours() - 8;

        if(openTimeInOpenDay >= openTimeInEndDay){
            block.end = moment.unix(block.start).set('hour', 22).set('minute', 0).set('second', 0).unix();
        }else{
            block.start = moment.unix(block.end).set('hour', 8).set('minute', 0).set('second', 0).unix();
        }
    }else if(moment.unix(block.end).startOf('day').diff(moment.unix(block.start).startOf('day'),'days') < 0){
        console.log(ERR_End_Time_Greater_Start_Time);
        throw new Error('ERR_End_Time_Greater_Start_Time');
    }


    return block;
}


module.exports.getLargestOpenBlockFromCSV = getLargestOpenBlockFromCSV;
