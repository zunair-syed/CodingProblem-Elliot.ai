





const IS_START_OF_INTERVAL = "S";
const IS_END_OF_INTERVAL = "E";


var arrayOfIntervals = [
                        {time:1, intervalKind:"S"},
                        {time:3, intervalKind:"E"},
                        {time:8, intervalKind:"S"},
                        {time:14,intervalKind:"E"},
                        {time:6, intervalKind:"S"},
                        {time:8, intervalKind:"E"},
                        {time:9, intervalKind:"S"},
                        {time:12,intervalKind:"E"},
                        {time:7, intervalKind:"S"},
                        {time:10,intervalKind:"E"}
                       ];

arrayOfIntervals.push({time:0, intervalKind:"S"},{time:0, intervalKind:"E"});
arrayOfIntervals.push({time:24, intervalKind:"S"},{time:24, intervalKind:"E"});

// var arrayOfSORTEDIntervals = [
//                        {1,"S"},
//                        {3,"E"},
//                        {6,"S"},
//                        {7,"S"},
//                        {8,"S"},
//                        {9,"S"},
//                        {10,"E"},
//                        {12,"E"},
//                        {13,"E"},
//                        {14,"E"},
//                       ];

arrayOfIntervals.sort((point1, point2) => {
    if(point1.time == point2.time){
        if(point1.intervalKind == IS_START_OF_INTERVAL && point2.intervalKind == IS_END_OF_INTERVAL){
            return -1;
        }else if(point2.intervalKind == IS_START_OF_INTERVAL && point1.intervalKind == IS_END_OF_INTERVAL){
            return 1;
        }
    }

    return point1.time - point2.time;

});

console.log("sorted Arr: " + JSON.stringify(arrayOfIntervals, null, 4));

var arrOfOpenTime = [];
var wasJustOpenInterval = false;
var openIntervalObj = {};

var howManyIntervalsCurrently = 0;
arrayOfIntervals.forEach((intervalPoint) => {
    if(intervalPoint.intervalKind == IS_START_OF_INTERVAL){
        howManyIntervalsCurrently++;
        if(wasJustOpenInterval){
            wasJustOpenInterval = false;
            openIntervalObj.end = intervalPoint.time;
            openIntervalObj.openTime = openIntervalObj.end - openIntervalObj.start
            arrOfOpenTime.push(openIntervalObj);
            openIntervalObj = {}; //DONT THINK U NEED TO DO DIS
        }
    }else if(intervalPoint.intervalKind == IS_END_OF_INTERVAL){
        howManyIntervalsCurrently--;
    }else{
        console.log("SOMETHING GONE WRONG");
    }

    if(howManyIntervalsCurrently < 0){
        console.log("SOMETHING GONE WRONG, too many ends");
    }

    console.log("howManyIntervalsCurrently: " + howManyIntervalsCurrently);
    if(howManyIntervalsCurrently == 0){
        wasJustOpenInterval = true;
        openIntervalObj.start = intervalPoint.time;
    }
})







arrOfOpenTime.forEach((obj) => {
    console.log("openTines objs: " + JSON.stringify(obj));
})
