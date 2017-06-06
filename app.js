var moment = require('moment');
var csvToArr = require('csv-to-array');
const IS_START_OF_INTERVAL = "S";
const IS_END_OF_INTERVAL = "E";
const NO_BLOCKS_OPEN = "NO_BLOCKS_OPEN";
const COLOUMNS = ["userID", "start", "end"];
const ERR_Invalid_Interval_Kind = "Invalid_Interval_Kind";
const ERR_End_Time_Greater_Start_Time = "End_Time_Cannot_Be_Greater_Than_Start_Time";

var path = __dirname + "/calendar.csv";
readCSVData(path)
    .then((csvArr)=>{
        var intervalArr = distributeEndStartTimes(csvArr);
        intervalArr = formatAndFilterMeetings(intervalArr);
        intervalArr = findOpenIntervals(intervalArr);

        var biggestBlockofSpace = getBiggestBlockOpenWithinHours(intervalArr);
        var formattedBlockProperties = {
            openDuration: biggestBlockofSpace.openTime,
            startTime: moment.unix(biggestBlockofSpace.start).format(),
            endTime: moment.unix(biggestBlockofSpace.end).format()
        }
        console.log(`Biggest Open Time Was ${formattedBlockProperties.openDuration} seconds from ${formattedBlockProperties.startTime} to ${formattedBlockProperties.endTime}`);

    },(err) => {
        console.log("Something went wrong while reading CSV");
        console.log(err);
    })



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
                openIntervalObj.openTime = moment(openIntervalObj.end).diff(moment(openIntervalObj.start)); //in seconds
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


function getBiggestBlockOpenWithinHours(arrOfOpenTime){
    var biggestTimeBlockOpen = NO_BLOCKS_OPEN;

    arrOfOpenTime.forEach((obj) => {
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

                obj.openTime = moment(obj.end).diff(moment(obj.start)); //in seconds
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

//
//
//
//
// csvToArr({
//     file: __dirname + "/calendar.csv",
//     columns: COLOUMNS
// }, function (err, array) {
//     console.log(err || array);
//
//     var arrayOfIntervals = [];
//     array.forEach((meeting) => {
//
//         var startUnixTime = moment(meeting.start).unix();
//         var endUnixTime = moment(meeting.end).unix();
//
//         if(moment(meeting.start) < moment() && moment(meeting.end) >= moment() ){
//             startUnixTime = moment().unix();
//         }
//
//         if(moment(meeting.start) <= moment().add(1, 'weeks').endOf('day').unix() && moment(meeting.end) > moment().add(1, 'weeks').endOf('day').unix() ){
//             endUnixTime = moment().add(1, 'weeks').set('hour', 22).set('minute', 0).set('second', 0).unix();
//         }
//
//         arrayOfIntervals.push({intervalKind:IS_START_OF_INTERVAL, time:startUnixTime});
//         arrayOfIntervals.push({intervalKind:IS_END_OF_INTERVAL, time:endUnixTime});
//     })
//
//     testFunc(arrayOfIntervals);
// });
//
//
//
// function testFunc(arrayOfIntervals){
//     // console.log("arrayOfIntervals: " + JSON.stringify(arrayOfIntervals, null, 4));
//
//     var startCalender = moment().unix();
//     var endCalender = moment().add(1, 'weeks').endOf('day').unix();
//
//     arrayOfIntervals = arrayOfIntervals.filter((obj) => {
//         return ( (obj.time >= startCalender) && (obj.time <= endCalender) );
//     });
//
//     arrayOfIntervals.push({time:startCalender, intervalKind:"S"},{time:startCalender, intervalKind:"E"});
//     arrayOfIntervals.push({time:endCalender, intervalKind:"S"},{time:endCalender, intervalKind:"E"});
//
//     arrayOfIntervals = arrayOfIntervals.sort((point1, point2) => {
//         if(point1.time == point2.time){
//             if(point1.intervalKind == IS_START_OF_INTERVAL && point2.intervalKind == IS_END_OF_INTERVAL){
//                 return -1;
//             }else if(point2.intervalKind == IS_START_OF_INTERVAL && point1.intervalKind == IS_END_OF_INTERVAL){
//                 return 1;
//             }
//         }
//
//         return point1.time - point2.time;
//     });
//
//
//
//     console.log("\n\nSORTED arrayOfIntervals: " + JSON.stringify(arrayOfIntervals, null, 4));
//
//
//     var arrOfOpenTime = [];
//     var wasJustOpenInterval = false;
//     var openIntervalObj = {};
//
//     var howManyIntervalsCurrently = 0;
//     arrayOfIntervals.forEach((intervalPoint) => {
//         if(intervalPoint.intervalKind == IS_START_OF_INTERVAL){
//             howManyIntervalsCurrently++;
//             if(wasJustOpenInterval){
//                 wasJustOpenInterval = false;
//                 openIntervalObj.end = intervalPoint.time;
//                 openIntervalObj.openTime = moment(openIntervalObj.end).diff(moment(openIntervalObj.start)); //in seconds
//                 console.log("openIntervalObj: " + JSON.stringify(openIntervalObj));
//                 arrOfOpenTime.push(openIntervalObj);
//                 openIntervalObj = {}; //DONT THINK U NEED TO DO DIS
//             }
//         }else if(intervalPoint.intervalKind == IS_END_OF_INTERVAL){
//             howManyIntervalsCurrently--;
//         }else{
//             console.log("SOMETHING GONE WRONG");
//         }
//
//         if(howManyIntervalsCurrently < 0){
//             console.log("SOMETHING GONE WRONG, too many ends");
//         }
//
//         // console.log("howManyIntervalsCurrently: " + howManyIntervalsCurrently);
//         if(howManyIntervalsCurrently == 0){
//             wasJustOpenInterval = true;
//             openIntervalObj.start = intervalPoint.time;
//         }
//     })
//
//     var biggestTimeBlockOpen = "NONE";
//     arrOfOpenTime.forEach((obj) => {
//         //if not on the same day, figure out which open-spot bigger on each day
//         if(moment.unix(obj.start).date() != moment.unix(obj.end).date()){
//             if(moment.unix(obj.end).startOf('day').diff(moment.unix(obj.start).startOf('day'),'days') > 1){ //If we have an empty day, make that the biggest spot
//                 obj.start = moment.unix(obj.start).add(1, 'days').set('hour', 8).set('minute', 0).set('second', 0).unix();
//                 obj.end   = moment.unix(obj.start).set('hour', 22).set('minute', 0).set('second', 0).unix();
//
//             }else if(moment.unix(obj.end).startOf('day').diff(moment.unix(obj.start).startOf('day'),'days') == 1){ // if no empty days in between
//                 var tempStart = obj.start;
//                 var tempEnd = obj.end;
//
//                 if(moment.unix(obj.start).hours() < 8){
//                     tempStart= moment.unix(obj.start).set('hour', 8).set('minute', 0).set('second', 0).unix();
//                 }else if(moment.unix(obj.start).hours() > 22){
//                     tempStart = moment.unix(obj.start).set('hour', 22).set('minute', 0).set('second', 0).unix();
//                 }
//
//                 if(moment.unix(obj.end).hours() < 8){
//                     tempEnd = moment.unix(obj.end).set('hour', 8).set('minute', 0).set('second', 0).unix();
//                 }else if(moment.unix(obj.start).hours() > 22){
//                     tempEnd = moment.unix(obj.end).set('hour', 22).set('minute', 0).set('second', 0).unix();
//                 }
//
//                 var openTimeInOpenDay = 22 - moment.unix(tempStart).hours();
//                 var openTimeInEndDay = moment.unix(tempEnd).hours() - 8;
//
//                 if(openTimeInOpenDay >= openTimeInEndDay){
//                     obj.end = moment.unix(obj.start).set('hour', 22).set('minute', 0).set('second', 0).unix();
//                 }else{
//                     obj.start = moment.unix(obj.end).set('hour', 8).set('minute', 0).set('second', 0).unix();
//                 }
//             }
//             // else{
//             //     console.log("this should not happen");
//             // }
//         }
//
//
//         if(!(moment.unix(obj.start).hours() < 8 && moment.unix(obj.end).hours() < 8)){
//             if(!(moment.unix(obj.start).hours() > 22 && moment.unix(obj.end).hours() > 22)){
//
//                 if(moment.unix(obj.start).hours() < 8){
//                     obj.start = moment.unix(obj.start).set('hour', 8).set('minute', 0).set('second', 0).unix();
//                 }
//
//                 if(moment.unix(obj.end).hours() > 22){
//                     obj.end = moment.unix(obj.end).set('hour', 22).set('minute', 0).set('second', 0).unix();
//                 }
//
//
//                 console.log("good time");
//                 obj.openTime = moment(obj.end).diff(moment(obj.start)); //in seconds
//                 if(biggestTimeBlockOpen == "NONE" || biggestTimeBlockOpen.openTime <= obj.openTime){
//                     biggestTimeBlockOpen = obj;
//                 }
//             }
//         }
//     })
//     console.log("BIGGESTTIME |  " + moment.unix(biggestTimeBlockOpen.start).format()  + "  TO  " +  moment.unix(biggestTimeBlockOpen.end).format() + " | " + biggestTimeBlockOpen.openTime);
// }
