/*global game: true, players: true*/ 
/*properties
    addDestination, addPlayer, chooseRegion, cities, city, color, destinations, 
    floor, getCity, getColor, getDestination, getPayout, getRandomCity, 
    getRandomRegion, getRegion, index, label, length, log, max, min, payouts, 
    pop, printDestinations, push, random, region, toString, undoAddDestination
*/
/*jslint white: true, devel: true */  
    
    
//PLAYER OBJECT DEFINITION
var player= function(spec) {
    spec.color= spec.color||"none";
    console.log("create player object");
    
    spec.destinations= [];
    
    var that={}, currentDestination = function(n) {
        //pass in a specific number, or just get the last one
        n = n||spec.destinations.length;
        
        //return most recent destination
        return spec.destinations[n-1];

        
    };
    
    that={};
    
    that.getDestination= function(n) {
        
        return currentDestination(n);
        
    };
    that.getRegion= function(n) {
        
        return currentDestination(n).region.label;
        
    };
    that.getCity= function(n) {
        
        return currentDestination(n).city.label;
        
    };
    that.getPayout= function(n) {
        
        return currentDestination(n).payouts.toString();
        
    };
    
    
    that.chooseRegion= function(regionindex) {
        var newDest={}, currentDest= currentDestination();
        
        newDest.region=game.getRandomRegion(regionindex);
        newDest.city= game.getRandomCity(newDest.region);
        
        
        newDest.payouts= game.getPayout(currentDest.city, newDest.city);
        
        spec.destinations.push(newDest);
                
        console.log(spec.color);
        console.log(spec.destinations);
        
        
    };
    that.nextDestination= function(newDest) {
      
        if (newDest) {
          spec.destinations.push(newDest);
          return true;
        } else {
          return false;
        }
      
    }
    that.addDestination= function() {
        var n= spec.destinations.length, 
        newDest= {}, 
        newRegion= game.getRandomRegion(), //returns a label and index
        currentDest= currentDestination();
        
        console.log(newRegion);
    
        console.log(currentDest);
        
        if (n>0) {

            //if the region is the same as last destination, ask player for a region
            
            if (newRegion.index === currentDest.region.index) {
                
                //railbaron.askRegion();
                console.log("ask for region");
                
                //disbale add button
                //enable picker
                
                
                return false;
                
            }
            //set city normally and look up payout
            newDest.region=newRegion;
            newDest.city= game.getRandomCity(newRegion);
            newDest.payouts= game.getPayout(currentDest.city, newDest.city);


            
        } else {
        //first destination, set as home

            newDest.region=newRegion;
            newDest.city= game.getRandomCity(newRegion);
            newDest.payouts= "Home";
        }               

        spec.destinations.push(newDest);
        
        console.log(spec.color);
        console.log(spec.destinations);
        return true;
        
    };
    
    that.undoAddDestination= function() {
        spec.destinations.pop();
        console.log(spec.destinations);
    };
    
    that.getColor= function() {
        return spec.color;
    };
    
    that.printDestinations= function() {
        var table="<table>\n", i=0;
        
        for (i=0;i< spec.destinations.length; i++) {
            table+="\t<tr>\n";

            table+="\t\t<td>"+spec.destinations[i].city.label+"</td>\n";
            table+="\t\t<td>"+spec.destinations[i].payouts+"</td>\n";
            table+="\t</tr>\n";
        }
        table+= "</table>\n";
        
        return table;
    };
    
    return that;
};

//GAME OBJECT DEFINITION
//needs to be a singleton so it can be called without instantiating


var singleton= function (){
    var instance = (function() {
        var codes= [ 
            //region and city code lookup table
            // Reg, NE, SE, NC, SC, P,  NW, SW
                [  7,   4,  8 , 1,  10, 5,  8,  2],
                [  4,   8,  8 , 0,  10, 8,  6,  3],
                [  4,   6,  8 , 1,  1,  4,  6,  3],
                [  4,   6,  1 , 1,  8,  8,  6,  3],
                [  7,   5,  6 , 3,  1,  4,  4,  2],
                [  7,   8,  4 , 0,  9,  5,  4,  2],
                [  5,   5,  6 , 0,  3,  1,  4,  2],
                [  6,   1,  10, 7,  3,  6,  3,  8],
                [  6,   1,  10, 7,  2,  6,  1,  8],
                [  5,   1,  7 , 7,  2,  2,  1,  8],
                [  6,   4,  8 , 0,  2,  2,  4,  8],
                [  5,   4,  2 , 2,  6,  3,  8,  7],
                [  2,   4,  2 , 2,  6,  3,  8,  7],
                [  2,   4,  3 , 2,  6,  0,  7,  5],
                [  2,   0,  0 , 2,  4,  0,  7,  7],
                [  3,   2,  0 , 4,  8,  0,  7,  6],
                [  3,   3,  0 , 4,  0,  3,  7,  1],
                [  1,   2,  9 , 5,  5,  3,  5,  4],
                [  1,   7,  5 , 6,  7,  3,  2,  0],
                [  1,   4,  7 , 6,  7,  7,  0,  9],
                [  1,   4,  5 , 0,  5,  7,  0,  4],
                [  1,   4,  7 , 6,  6,  5,  8,  4]
        ],
        
        regions= [
            {"label":"Northeast", "index":1}, 
            {"label":"Southeast","index":2}, 
            {"label":"North Central",   "index":3},
            {"label":"South Central",           "index":4},
            {"label":"Plains",          "index":5},
            {"label":"Northwest",           "index":6},
            {"label":"Southwest",           "index":7}
        
        
        ],
    
        cities= [
            {
                "label":"Northeast",
                "cities": [
                    {"label":"Albany", "index":0}, 
                    {"label":"Baltimore","index":1}, 
                    {"label":"Boston",  "index":2},
                    {"label":"Buffalo",         "index":3},
                    {"label":"New York",            "index":4},
                    {"label":"Philadelphia",            "index":5},
                    {"label":"Pittsburgh",          "index":6},
                    {"label":"Portland, ME",            "index":7},
                    {"label":"Washington DC", "index":8}
                ]
            }, {
                    
                "label":"Southeast",
                "cities": [
                    {"label":"Atlanta",         "index":9},
                    {"label":"Charleston",          "index":10},
                    {"label":"Charlotte",           "index":11},
                    {"label":"Chattanooga",         "index":12},
                    {"label":"Jacksonville",            "index":13},
                    {"label":"Knoxville",           "index":14},
                    {"label":"Miami",           "index":15},
                    {"label":"Mobile",          "index":16},
                    {"label":"Norfolk",         "index":17},
                    {"label":"Richmond",            "index":18},
                    {"label":"Tampa",           "index":19}
                ]
            }, {
                    
                "label":"North Central",
                "cities":[
                    {"label":"Chicago",         "index":20},
                    {"label":"Cincinnati",          "index":21},
                    {"label":"Cleveland",           "index":22},
                    {"label":"Columbus",            "index":23},
                    {"label":"Detroit",         "index":24},
                    {"label":"Indianapolis",            "index":25},            
                    {"label":"Milwaukee",           "index":26},            
                    {"label":"St. Louis",           "index":27}
                ]
            }, {
                    
                "label":"South Central",
                "cities":[          
                    {"label":"Birmingham",          "index":28},
                    {"label":"Dallas",          "index":29},
                    {"label":"Fort Worth",          "index":30},
                    {"label":"Houston",         "index":31},
                    {"label":"Little Rock",         "index":32},
                    {"label":"Louisville",          "index":33},
                    {"label":"Memphis",         "index":34},
                    {"label":"Nashville",           "index":35},
                    {"label":"New Orleans",         "index":36},
                    {"label":"San Antonio",         "index":37},
                    {"label":"Shreveport",          "index":38}
                ]
            }, {
                    
                "label":"South Central",
                "cities":[          
                    {"label":"Denver",          "index":39},
                    {"label":"Des Moines",          "index":40},
                    {"label":"Fargo",           "index":41},
                    {"label":"Kansas City",         "index":42},
                    {"label":"Minneapolis",         "index":43},
                    {"label":"Oklahoma City",           "index":44},
                    {"label":"Omaha",           "index":45},
                    {"label":"Pueblo",          "index":46},
                    {"label":"St. Paul",            "index":47}
                ]
            }, {
                    
                "label":"South Central",
                "cities":[          
                    {"label":"Billings",            "index":48},
                    {"label":"Butte",           "index":49},
                    {"label":"Casper",          "index":50},
                    {"label":"Pocatello",           "index":51},
                    {"label":"Portland, OR",            "index":52},
                    {"label":"Rapid City",          "index":53},
                    {"label":"Salt Lake City",          "index":54},
                    {"label":"Seattle",         "index":55},
                    {"label":"Spokane",         "index":56}
                ]
            }, {
                    
                "label":"Southwest",
                "cities":[          
                    {"label":"El Paso",         "index":57},
                    {"label":"Las Vegas",           "index":58},
                    {"label":"Los Angeles",         "index":59},
                    {"label":"Oakland",         "index":60},
                    {"label":"Phoenix",         "index":61},
                    {"label":"Reno",            "index":62},
                    {"label":"Sacramento",          "index":63},
                    {"label":"San Diego",           "index":64},
                    {"label":"San Francisco",           "index":65},
                    {"label":"Tucumcari",           "index":66}
                ]
            }
                
                
        ],
            
            
    //payouts[high city code][low city code]
        payouts= [
            [],//dummy row
            [ 3.5],
            [ 2  ,  4  ],
            [ 3  ,  4  ,  5],
            [ 1.5,  2  ,  2.5,              4],
            [ 2.5,  1  ,  3,        4,      1],
            [ 5.5,  3.5,  6.5,  2.5,    4.5,            3.5],
            [ 3  ,  5.5,  1,        6,      3.5,            4.5,8],
            [ 3.5,  5  ,  4.5,4.5,2,1.5,3,5.5],
            [10  ,  7  , 11,9.5,8.5,7.5,8,12,6.5],
            [ 9.5,  5.5,  9.5,9.5,7.5,8,8,11,5,3],
            [ 7.5,  4  ,  8.5,8,6,5,6,9.5,4,2.5,2.5],
            [10  ,  6.5, 11.5,8,8.5,7.5,7,12,6,1.5,4.5,4],
            [11  ,  8  , 12,12,10,9,10.5,13,6,3.5,2.5,4,5],
            [ 8.5,  5.5,  9.5,7.5,7.5,6.5,6,10.5,5,2,4,2.5,1,5.5],
            [15  , 11.5, 16,15.5,13.5,12.5,14,17,11,7,6,7.5,8.5,3,9],
            [13.5, 10.5, 14.5,12,12,11,10.5,14.5,10,3.5,6,5,5,4,5.5,8.5],
            [ 6  ,  2.5,  7,6.5,4.5,3.5,5,8,2.5,5.5,4.5,4,6.5,6,5.5,9.5,9.5],
            [ 5  ,  1.5,  5.5,5.5,3.5,2.5,4,7,1,6,4,3.5,6,6.5,5,10,9.5,1],
            [13.5,  10 , 14,14,12,11,12.5,15,9.5,5.5,4.5,6,2,2,7,2,6.5,8,8],
            [ 8  ,  8  , 10,5,9,8,4.5,11.5,7.5,7.5,10,8.5,6,11,5.5,14.5,8.5,9.5,8.5,12.5],
            [ 7  ,  6  ,  9.5,4.5,7.5,6.5,3,10.5,5.5,5,7,5.5,3.5,8.5,3,12,7.5,7,6,10,3],
            [ 5  ,  4.5,  7,2,5.5,5,1.5,8,4.5,7.5,9.5,6.5,6,11,5.5,14.5,10,6.5,5.5,12.5,3.5,2.5],
            [ 6  ,  5  ,  8,3,6.5,5.5,2,9.5,5,6,8.5,6,4.5,9.5,4,13,8,7,5.5,11.5,3.5,1,1.5],
            [ 5.5,  6  ,  7.5,2.5,6.5,6.5,3,8.5,6.5,7.5,10,8,6,11,5,14.5,10,8,7,12.5,2.5,2.5,1.5,2],
            [ 7.5,  7  ,  9.5,4.5,8,7,3.5,10.5,6.5,6,8,6.5,4.5,9.5,4,13,8,8,7,11,2,1,3,1.5,3],
            [ 9  ,  8  , 11,6,10,9,5.5,12,8.5,8,11,9.5,7,11.5,6.5,15.5,9,10.5,9.5,13.5,1,3.5,4,4,3.5,2.5],
            [10  ,  9  , 12,7,10.5,9.5,6,13,9,6,9,8,4.5,9,5.5,13,6.5,10,9,11,3,3.5,5,4,5,2.5,3.5],
            [11  ,  8  , 12,9,10,9,8,13.5,7.5,1.5,5,4,1.5,4.5,2.5,8,3,7,7.5,6,6.5,5,7.5,6,7.5,5,7.5,5],
            [17  , 14.5, 18.5,14,16,15.5,13,19.5,14,8,11.5,11,9,11,9,14.5,6,14,14,12.5,9.5,9.5,12.5,11,12,9.5,10.5,7,6.5],
            [17  , 14.5, 19.5,14,16.5,15.5,13,20.5,14,8,11.5,11,9,11,9,14.5,6,14,14,12.5,9.5,9.5,12.5,11,12,9.5,10.5,7,6.5,0.5],
            [18.5, 15  , 19.5,15.5,17,16,14.5,20.5,15,8.5,11.5,11,8.5,9.5,9.5,13.5,5,14.5,14.5,11.5,12,12.5,13.5,13,13.5,11,11,9,7,2.5,2.5],
            [13.5, 11  , 15,10.5,13,12,9.5,18,10.5,5.5,8.5,8.5,5.5,8,5.5,11.5,5,11,10.5,9.5,6.5,6.5,9,6.5,9,5,7.5,3.5,4,3.5,4,4.5],
            [ 8.5,  7  , 10.5,5.5,8.5,8,4.5,11.5,6.5,4.5,7,5.5,3,8,3,12,5.5,8,7,10,3,1,3.5,2.5,3.5,1,4,2.5,4,8.5,8.5,10,5],
            [12.5,  9.5, 14,9.5,11.5,10.5,8,15,9.5,4,7.5,7,4,7,4,10.5,3.5,9.5,9,8.5,5.5,5,7,6,7.5,5,6,3,2.5,9,9,6,1.5,4],
            [10.5,  7.5, 12,7.5,9.5,8.5,6,13,7,3,6,5,1.5,6.5,2,10,5,8,7,8,4.5,3,5.5,4,5.5,3,5.5,3,2,7,7,8.5,3.5,2,2.5],
            [15  , 11.5, 15.5,13,13.5,12.5,11.5,16.5,11,5,7.5,7.5,6.5,6,6,10,1.5,10,10.5,8,9,8.5,11,9.5,11,8.5,10,7,3.5,5,5,3.5,4.5,7.5,4,5.5],
            [19.5, 17  , 21,16.5,19,18,15.5,22.5,17,10.5,13.5,13.5,10.5,12,11.5,15.5,7,16,16.5,13.5,12,12.5,14.5,13.5,14,11.5,13,9,9.5,2.5,2.5,2,6,11.5,7.5,10,5.5],
            [16  , 12.5, 16.5,14,15.5,13.5,12,18,12,6.5,9.5,9,7,9,8,12.5,4.5,12,12,11,8.5,8.5,11,11.5,10.5,9,8.5,8.5,4.5,2,2,2.5,2,8,4,6.5,3,5],
            [18.5,  8  , 20.5,15.5,19.5,18.5,15,21.5,18,15.5,18.5,18,14,18,14.5,22,15,19,18.5,20,10.5,12.5,13.5,13,13,11.5,10.5,9,13.5,8.5,8.5,11,11,12,11,12.5,13.5,11,10],
            [12  , 11.5, 14,9,12.5,11.5,8.5,15,11,9.5,13,11.5,8,13,9,16.5,10,13,12,14.5,3.5,6.5,7,7,6.5,5.5,3.5,3.5,8,7.5,7.5,10,7,6,6.5,6.5,10.5,10,8,7],
            [14.5, 14.5, 16.5,11.5,15.5,14.5,11,17.5,14,13.5,16.5,15,12.5,17,12,21,14.5,16,15,19,6.5,9,10,9.5,9,8,5.5,8,13,12.5,12.5,15,12,9.5,11,11,15,15,13,11.5,5],
            [12.5, 12  , 14.5,9.5,13.5,12,9,16,11.5,9,12,11,7.5,11.5,8,15.5,8.5,13,12,13.5,4.5,6,8,6.5,7,5,5.5,3,7.5,5,5,8,5,5.5,5,6,8.5,8,5.5,6.5,2,7],
            [12.5, 12  , 14,9,13,12,8.5,15.5,11.5,11.5,14,12.5,10,15,9.5,18.5,12.5,13.5,12.5,16.5,4,7,7.5,7.5,6.5,6,3.5,5.5,10.5,10,10,12.5,9.5,7,9,8.5,12.5,12.5,8,9,2.5,2.5,5],
            [15.5, 14.5, 17.5,12.5,16,15,11.5,18.5,14,9,12,11.5,9,12,9,15.5,8,15,14,13.5,8,9,10.5,10,10.5,7.5,8.5,5.5,7.5,2.5,2.5,5,3.5,8.5,5,7.5,7.5,5,10.5,7.5,5.5,10.5,3.5,8],
            [13  , 13  , 15,10,14,13,9.5,16,12.5,10,13.5,12.5,9,13.5,9.5,17,10.5,14,13.5,15,5,7.5,8.5,8,7.5,6.5,5,4,9,7,7,9.5,7,7,6.5,7.5,10.5,10,7.5,5.5,1.5,6,2,3.5,5.5],
            [18.5, 18  , 21,15.5,19.5,18.5,15,22,18,15,18.5,18,14,18,14.5,21.5,14,19,18.5,20,10.5,12.5,13.5,13,13,11.5,11.5,9,13.5,7.5,7.5,10,10,12,11,12.5,13.5,9.5,10,1,7,12.5,6,9.5,7,5.5],
            [12  , 12  , 14,9,13,12,8.5,15.5,11.5,11.5,14,12.5,10,15,9.5,18.5,12.5,13.5,12.5,16.5,4,7,7.5,7.5,6.5,6,3.5,5.5,10.5,10,10,12.5,9.5,7,9,8.5,12.5,12.5,10.5,9,2.5,2.5,5,0,8,3.5,9.5],
            [21  , 21  , 23,18,22,21,17.5,24,20.5,19,22.5,21,18,22.5,18.5,26,19,22,21.5,24,13,15.5,16,16,15.5,14.5,12,13,18,15,15,17.5,15.5,16,15.5,16.5,19,17.5,16,6.5,10.5,6.5,10.5,9,14,9,7.5,9],
            [23.5, 23  , 25.5,20.5,24,23.5,20,26.5,22.5,21.5,26,17.5,14,24.5,21,28.5,21,25,23.5,26.5,15,18,18.5,18.5,18,17,14.5,15.5,20,17.5,17.5,20,18,18,17.5,18.5,21.5,19.5,18.5,9,14,9,13,11,16.5,11.5,10,11,2.5],
            [18  , 18  , 20,15,19,18,14.5,21.5,17.5,25.5,19,17.5,14,18.5,14.5,22,15.5,19,18.5,15,10,12.5,13.5,13,12.5,11.5,10,10,14,11.5,11.5,14.5,11.5,12,12,12.5,15.5,14,12.5,3.5,6.5,7.5,7,8,10.5,5,4.5,8,3.5,5.5],
            [23.5, 23.5, 25.5,20.5,24.5,23.5,20,27,23,21,24,23,21.5,23.5,20.5,27.5,22.5,24.5,24,25.5,15,18,19,18.5,18,17,15.5,14.5,20.5,15,15,17.5,16,17.5,17,19,18.5,17.5,15.5,6,12,13.5,12.5,13.5,12.5,10.5,7.5,13.5,5,2.5,7.5],
            [30  , 30.5, 32, 27,31,30,26.5,33.5,30,28,31,30.5,26.5,31.5,27.5,35,28.5,32,31,33,22,24.5,25.5,25.5,25,24.5,21.5,22,26.5,22.5,22.5,25,24.5,24.5,25,25,27.5,25,24,13.5,19,16,19.5,18,21.5,17.5,14.5,18,9.5,7,13,7],
            [17, 17, 20.5,14,18,17,13.5,21.5,18,16,19,18,14.5,19,15,22.5,16,19.5,19,20.5,9,12,12.5,13.5,13,11,9,9.5,14.5,12.5,12.5,15.5,12.5,12.5,12.5,13,15.5,15,13,5.5,7,4.5,7.5,5,9,5.5,6.5,5,5,7.5,3,10,14.5],
            [23.5, 23, 25.5, 20.5,24,23.5,20,26.5,23,20.5,23.5,22.5,20.5,23.5,20,27,19.5,24.5,23.5,25,15,18,18.5,18,18,17,15,14.5,19,13.5,13.5,16,16,17,16.5,19,18.5,16,15,5.5,11.5,13,12,13.5,12.5,10.5,6.5,13.5,6.5,4.5,7.5,1.5,9,9.5],
            [31.5, 29.5, 31.5,26.5,30.5,29.5,26,32.5,29,28,31.5,30,27,31.5,27,35,28,31,30,33,21.5,24,25,25,24,23,21,22,27,24,24,26.5,26.5,25,24.5,25.5,29,26.5,26,15.5,19.5,15,19.5,17.5,23,18,16,17.5,9,6.5,12.5,9,2,14,10.5],
            [26.5, 26.5, 28.5,23.5,27.5,26.5,23,29.5,26,28,28,27,18.5,28,24,32,25,28,27,30,18.5,21,12.5,21.5,21,20,18,19,24,21,21,23.5,23,22,21.5,22.5,26,23.5,22.5,12.5,16.5,12,16.5,14.5,20,15,13,14.5,6,3.5,9,6,3.5,11,8,3],
            [22  , 21, 24,19,23,22,18.5,25.5,20.5,14.5,19,17.5,15.5,17.5,15.5,21.5,13,21,20.5,19.5,14,15.5,17.5,17,16.5,15,14.5,12,13,6.5,6.5,8.5,10,15,11.5,13.5,11.5,16,8.5,7.5,11.5,16.5,9.5,14,7,11.5,6,14,14,16,9.5,13.5,20,13,12.5,22,20],
            [28  , 27.5, 30,25,28,28,24.5,26,27.5,23,26.5,26,24,26,24.5,30,21.5,29,28,28.5,19.5,22.5,23,22.5,22.5,21.5,19.5,19,23.5,16,16,17,19,21.5,21,22,20,14.5,17,10,16,17.5,16.5,18,15.5,15,11,18,11,9,12,6,13.5,14,4.5,15,17,13],
            [30.5, 29, 32.5,27.5,31,30,26.5,33.5,29,23,26,25.5,23.5,26,23.5,29.5,21,29.5,28.5,27.5,22.5,23.5,25.5,24,25,22.5,22.5,20.5,21,14.5,14.5,16.5,18.5,23,19.5,22,19.5,14.5,16.5,13.5,19.5,21,17.5,21.5,15,18,13.5,21.5,14.5,12,15,9,12,17.5,8,13.5,15.5,8,3],
            [31  , 30.5, 33,28,31.5,31,27.5,34,30.5,27,30.5,30,27,30,27,33.5,26,32,31,31.5,22.5,25.5,26,26.5,25.5,24.5,22.5,22,25.5,19.5,19.5,21,21.5,24.5,23,25.5,24.5,19,21.5,13.5,19,20.5,19.5,21,18,17.5,14,21,14,12,15,9,7,17.5,8,9,11,13,6.5,4.5],
            [27.5, 27, 29.5,24.5,28,27,23.5,30.5,26.5,19,22.5,24,19,22,21.5,26,17.5,26.5,26.5,24,19.5,21,22.5,21.5,22,20,19.5,18,17.5,11,11,13,16,22.5,17.5,19.5,16,10.5,13,10.5,17,22,15,19.5,12.5,16,9.5,19.5,19,16.5,14,14,16,16,12,18,20,4.5,7.5,4.5,9],
            [25.5, 28.5, 30.5,25.5,29.5,28.5,25,31.5,28,26,29.5,27.5,24.5,27.5,25,33,25,28.5,28,31,20,23,23.5,23.5,23,22,20.5,20.5,23,19,19,22,21.5,22.5,20.5,23,22,20,21,11.5,17,15,17.5,19,16,15.5,12,19,12,9.5,12.5,7,7.5,15.5,5.5,9.5,11,10.5,8,6,2.5,10.5],
            [27  , 30, 32,27,31,30,26.5,33.5,29.5,27,31,29,26,29,26.5,33.5,26,31,30.5,31.5,22,24.5,25,25,24.5,23.5,22,21,24,19.5,19.5,21,21.5,24,22,24.5,23.5,19,21.5,13,18,20,19,20.5,17.5,17,13.5,20.5,13.5,11,14,8.5,6.5,17,7,8.5,10,12,6.5,5,1,9,1.5],
            [31.5, 28.5, 32.5,27,30.5,29.5,26,33.5,28.5,22.5,26,25.5,23.5,25.5,23.5,29,21,28,28.5,27,22,23.5,25,24,24.5,22.5,23,20,21,14.5,14.5,16,18,22.5,19,21.5,19.5,17,16.5,14.5,20.5,22,17.5,22.5,14.5,19,13.5,22.5,15.5,13,16.5,11,13,18.5,9,15,17,8,4.5,1.5,6,4,8.5,6.5],
            [31  , 30.5, 33,28,31.5,31,27.5,34,30.5,27,30.5,30,27,30,27,33.5,26,32,31,31.5,22.5,25.5,26,26.5,25.5,24.5,22.5,22,25.5,19.5,19.5,21,21.5,24.5,23,25.5,24.5,19,21.5,13.5,19,20.5,19.5,21,18,17.5,14,21,14,12,15,9,7,17.5,8,9,11,13,6.5,4.5,0,9,2.5,1,6],
            [18.5, 18.5, 21, 16.5,20,19,15.5,22,18,13,16,15.5,13,16,13,19.5,11.5,18.5,18,17.5,11,12.5,14.5,14,14,11.5,11,9.5,11.5,5,5,8,7.5,12,8.5,11,10,7,6.5,4.5,9,14,6.5,11.5,4,8.5,3.5,11,11,13.5,8,11,18.5,11,9.5,20.5,17.5,3.5,9.5,11.5,14.5,8.5,15.5,14.5,11,14.5]
        ];
        
        //rolls 1 die for odd/even, and 2 dice for 2-12
        function roll() {
        
            var row= Math.floor(Math.random()*6) + Math.floor(Math.random()*6) + Math.floor(Math.random()*2) *11;
        
            console.log("row is "+row);
            
            return row;
        }
    
    return {
    // public interface
    
        addPlayer: function(color) {  //create a new player with a specific color
        
            console.log("add "+ color + " player");
            
            //check to see if player exists
            if !(player[color]) {
              var newPlayer={};
              newPlayer.color=color;
              
              
              players[color]=player(newPlayer);  //reference player's by their color
               
              return true;
            }
            return false;
        },
        newDestination: function(origin, region) {
          
          newDest={}, newRegion={};
          
          if (region) {
            newRegion=regions[region];
            
            
            
          } else {
            //get new Region
            var index= codes[roll()][0];
            var newRegion= regions[index];
            
            if (newRegion.label == origin.region.label) {
              // region matches current, ask for a new one
              return false;
            } 
  
          }
          
          if (newRegion.label !== origin.region.label) {
            newDest.region= newRegion;
          } 
                    
          index = codes[newRegion.index][roll()];
          var newCity = cities[newRegion.index-1].cities[index];
          newDest.city= newCity;
          
          if (origin) {
            var low= Math.min(origin.city.index, newDest.city.index),
               high= Math.max(origin.city.index, newDest.city.index);
                      
            newDest.payouts=payouts[high][low]*1000;
          } else {
          //first destination, is hometown
            newDest.payouts= "Home";
          }
          
          return newDest;
          
          
          
          
        },
        playerAddDestination: function{color,regionIndex){
          if !(player[color]) {
          // create a player if one doesn't exist.
            addPlayer(color);
            
            //set hometown
            var home= newDestination();
            player[color].nextDestination(home);
            
          } else {
            //get next destination
            var origin= player[color].getCurrentDestination();
            var newDest= newDestination(origin,regionIndex);
          
            //newdest is false if a dest didn't come back
            if (newDest) {
              //roll succeeded
              player[color].nextDestination(newDest)
            } else {
              //same region, let user choose
              //call board.askRegion  outside this function if it comes back false
              return false();
              //askRegion will return newDestination with the specified region
            }
          
          return player[color].printDestinations();
          } 
        },
        playerInfo: function(color) {
        
        if (player[color] !== null){
          //get current destination
          var obj={};
          obj.dest= players[color].currentDestination();
          
          //get hometown
          obj.home= players[color].currentDestination(0);
          
          return obj;
          }
          
        },
        
        
        playerUndo: function(color) {
          
        }
        listPlayers: function() {
          return players.join(',');
        }
        
     };
  }());

  singleton =function(){
  
  // re-define the function for subsequent calls
    return instance;
  };
  
  return singleton();  // call the new function

};

//GAME SETUP FUNCTIONS


function addDestination
    
    function(event){
      //set each buttons hovers 
      /*
      do i need this?  can i just set the default classes?
      */
      $(this).addClass("add");
      
      
      //set button to create a player, that corresponds to the ID
      var color= $(this).attr("id");
      
      //init player object
      var newPlayer={};
        newPlayer.color=color;
        
        //create the player of that color
        /* 
        global var for all players
        can i return a player object to the main page and add it to the game form there?
        */
        players[color]= player(newPlayer);
        
        //add home town
        players[color].addDestination();
        var hometown=players[color].getDestination();

        updateboard(".region-letter",hometown.region.label.toLowerCase()); 
        updateboard(".city-letter",hometown.city.label.toLowerCase());
        updateboard(".payout-letter",hometown.payouts.toString());
/*        $(this).attr("title",$(this).printDestinations()); */

              $("#"+color+" span.city").text(players[color].getCity()); 
              $("#"+color+" span.payout").text(players[color].getPayout()); 

        
        //after player is created, switch button's behavior so that it adds destinations
        $(this).off("click");
        
        $(this).click(function(event){
          currentPlayer=players[color];
        
          if ( players[color].addDestination()) {
            console.log(players[color]);
            //succesfully added location
          updateboard(".region-letter",players[color].getRegion());
            updateboard(".city-letter",players[color].getCity());
            updateboard(".payout-letter",players[color].getPayout());

              $("#"+color+" span.city").text(players[color].getCity()); 
              $("#"+color+" span.payout").text("$"+players[color].getPayout()); 
            

          //updateboard("region",a,b)?
            
          } else {
            //updateboard("region"a,b)?
          updateboard(".region-letter","choose region");
            
          //duplicate region, so ask
          $("#"+color).attr("disabled","disabled");
          
            
            //activate choose button(s)
          $(".region-selector").show(1000); 
          $(".region-selector").removeAttr("disabled"); 


          
          $(".region-selector").each(function(index) {
          
            //for each region selector, make it choose a city, which decativateafter one of them was clicked
            console.log(index+": "+$(this).attr("id"));
             
              $(this).click(function(event){
              currentPlayer.chooseRegion(index+1);
              updateboard(".region-letter",players[color].getRegion());
                updateboard(".city-letter",players[color].getCity());
                updateboard(".payout-letter",players[color].getPayout());
              
              
              $(".region-selector").off("click");
              $(".region-selector").hide(1000);
/*          updateboard(players[color].getDestination()); */
                
              $("#"+color).removeAttr("disabled"); 
              
              $("#"+color+" span.city").text(players[color].getCity()); 
              $("#"+color+" span.payout").text("$"+players[color].getPayout()); 

                
            });

             
          });
          }
          
          console.log(players[color].printDestinations());
          //$("#board").html(players[color].getDestination().city.label);
/*          updateboard(players[color].getDestination()); */
        });
      
     });
   
    
//helper functions -- to be made into an object at soem point


var selectregion= function(index) {
          //remove old onclick
          $(this).off("click");
          
          //set onclick to the player who clicked 
          $(this).onClick(function(event){
            game.playerAddDestination(playerColor, index);
            
            var dest= game.playerInfo(playerColor);
            updateBoard(dest.dest);
            
        }); 
    }
    
        
  //VIEW SPECIFIC FUNCTIONS - FLIPPY
  var askRegion= function(playerColor) {
    //display the region selector
        
        
        $(".region-selector").forEach(selectRegion);
  };
  
   
  var updateButton= function(color, dest) {
              $("#"+color+" span.city").text(dest.city.label); 
              $("#"+color+" span.payout").text(dest.payout); 
  };
  
   
  var updateFlippy= function(selector, label) {
    var alpha="abcdefghijklmnopqrstuvwxyz1234567890., ";
  
    $(selector).fadeOut(1000, function() {
      console.log("label:"+label);
      label.toLowerCase();
  
      $(selector).each(function(index) {
        var a= $(this).text();
        a.toLowerCase();
        //if panel needs to be updated for this word
          
        var b= label.charAt(index)||" ";
        
        if (a !== b) {
          console.log("this.text="+$(this).text());
            
            
            $(this).text(b);
        }
        
      }); 

      $(this).show();

    });
    
    var updateBoard= function(type, dest) {
      if (type == 'ask') {
        updateFlippy(".region-letter", "Choose Region");
      } else {
        updateFlippy(".region-letter",dest.region);
        updateFlippy(".city-letter",dest.city);
        updateFlippy(".payout-letter",dest.payout);
      }
      
    }
