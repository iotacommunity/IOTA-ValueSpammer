var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
var performance = require("performance-now");
var IOTA = require("iota.lib.js");

// ---------------------------------------
// Configure your spammer properties here:
// ---------------------------------------
var REPEATER_ON = false;    // REPEATER_ON = false:  If you don't want the repeater functionality.
var SPAM_ON = true;         // SPAMER_ON = false:  If you don't want the spammer functionality (no PoW!).
                            // ^^^^^^^^^^^ One of the 2 options should be true, 
                            //             otherwise it aint doing nothing!
var VALUESPAM_ON = true;    // VALUESPAM_ON = false:: If you don't want to spam with value (iota).

var USER_SEED = "USER_SEED";   // seed that contains iota and will  be used for spamming with value.
var SPAM_MESSAGE = "SPAMSPAMSPAM";    // only A-Z and 9 allowed!
var SPAM_TAG = "YOURNAME"   // only A-Z and 9 allowed!
var SPAM_FREQUENCY = 10     // minimum spam interval in seconds.
var SPAM_DEPTH_MIN = 3      // How deep to search for transactions to approve (minimum)
var SPAM_DEPTH_MAX = 12     // How deep to search for transactions to approve (maximum)
var IRI_PORT       = 14265  // Must match your port configuration for iri process
var TESTNET = true;        // Set to true only if you are using testnet.
// -------- end of configrable part ------

// -------- javascript code --------------
// -------- Do not modify!! --------------
var allnine = '999999999999999999999999999999999999999999999999999999999999999999999999999999999';
var ignore_tips = null;
var new_tips = [];
var new_tips_step = [] 
var previous_milestone_idx = 0;
var current_milestone_idx = 0;
var lock = false;
var lock_spam = false;
var next_spam_time = 0;
var spam_count = 0;
var spam_timesum = 0;
var spam_starttime = 0;
var trunk_tx;
var branch_tx;
var iri_is_synced = false;
var wanted_milestone;
var enable_spam   = false;
var balance_found = false;

var iota = new IOTA({
    'host': 'http://localhost',
    'port': IRI_PORT 
});

var transfers = [{
    'address': allnine,
    'value': 0,
    'message': SPAM_MESSAGE,
    'tag': SPAM_TAG
}];

process.argv.forEach((val, index) => {
    wanted_milestone = 0;
    if (index == 2) {
        wanted_milestone = val;
        console.log("");
        console.log("Repeater will start when milestone "+wanted_milestone+" is reached!");
        console.log("");
    }
});

// Start reading from stdin so we don't exit.
process.stdin.resume();

process.on('SIGINT', function () {
    iota.api.interruptAttachingToTangle(function(e,s) {
        if (e == null) {
            console.log("*Attachting stopped");
            process.exit(1);
        } else {
            console.log("*Attachting stopped with error");
            console.log(e)
            process.exit(1);
        }
    });
});

function collect_tips_at_startup() {
    ignore_tips = new Set();
    iota.api.getNodeInfo(function(e,s) {
        var solidMilestone = s.latestSolidSubtangleMilestoneIndex;
        var milestone = s.latestMilestoneIndex;
        if ((solidMilestone == 0) || (solidMilestone != milestone)) {
            console.log("*INFO:  waiting for synced with network.");
            lock = false;
            return;
        }
        iota.api.getTips(function(e,s) {
            if (e != null) {
                console.log("*ERROR:  cannot get tips at startup");
                console.log(" iota.lib.js returns this error:");
                console.log(e);
                process.exit(1);
            }
            var tips = s['hashes'];
            for (var i=0;i<tips.length;i++) {
                var key = tips[i].slice(0,12);
                ignore_tips.add(key);
            }
            lock = false;
            return;
        });
    });
}

function collect_fresh_arrived() {
    // collect the new tips since startup or the last milestone 
    iota.api.getTips(function(e,s) {
        if (e != null) {
            console.log("*ERROR:  cannot get tips");
            console.log(" iota.lib.js returns this error:");
            console.log(e);
            process.exit(1);
        }
        var tips = s['hashes'];
        for (var i=0;i<tips.length;i++) {
            var key = tips[i].slice(0,12);
            if (ignore_tips.has(key)==false) {
                ignore_tips.add(key);
                new_tips.push(tips[i]);
                new_tips_step.push(tips[i]);
                console.log("*INFO  New tip: "+tips[i]);
            }
        }
        // if milestone has changed, then re-broadcast the newcomers
        if (previous_milestone_idx != current_milestone_idx) {
            previous_milestone_idx = current_milestone_idx;
            broadcast_fresh_arrived();
        }
        else {
            if (new_tips_step.length > 9) {
                broadcast_intermediate(); 
            }
            else {
                lock = false
                return;
            }
        }
    });
}

function broadcast_fresh_arrived() {
    if (new_tips.length > 0) {
        console.log("*INFO  --- Milestone has changed, rebroadcasting the "+new_tips.length+" most recent txs");
        iota.api.getTrytes(new_tips, function(e,s) {
            if (e != null) {
                console.log("*ERROR  cannot get trytes");
                console.log(" iota.lib.js returns this error:");
                console.log(e);
                process.exit(1);
            }
            var trytes = s['trytes'];
            iota.api.broadcastTransactions(trytes, function(e,s) {
                if (e != null) {
                    console.log("*ERROR  cannot broadcast");
                    console.log(" iota.lib.js returns this error:");
                    console.log(e);
                    process.exit(1);
                }
                new_tips = [];
                new_tips_step = [];
                lock = false;
            });
        });
    }
    else {
        lock = false;
    }
}

function broadcast_intermediate() {
    if (new_tips_step.length > 0) {
        console.log("*INFO  --- rebroadcasting the "+new_tips_step.length+" most recent txs (intermediate step)");
        iota.api.getTrytes(new_tips_step, function(e,s) {
            if (e != null) {
                console.log("*ERROR  cannot get trytes");
                console.log(" iota.lib.js returns this error:");
                console.log(e);
                process.exit(1);
            }
            var trytes = s['trytes'];
            iota.api.broadcastTransactions(trytes, function(e,s) {
                if (e != null) {
                    console.log("*ERROR  cannot broadcast");
                    console.log(" iota.lib.js returns this error:");
                    console.log(e);
                    process.exit(1);
                }
                new_tips_step = [];
                lock = false;
            });
        });
    }
    else {
        lock = false;
    }
}

function spam_spam_spam() {
    spam_starttime = performance();
    var seed = allnine;
    // Change the seed if value spamming is enabled and balance has been found.
    if(VALUESPAM_ON == true && balance_found == true) seed = USER_SEED;

    var weight = 18
    if (TESTNET==true) weight = 13;
    var depth = Math.floor(Math.random()*(SPAM_DEPTH_MAX-SPAM_DEPTH_MIN+1)+SPAM_DEPTH_MIN);
    iota.api.sendTransfer(seed,depth,weight,transfers,function(e,s) {
        if (e != null) {
            console.log("*ERROR  sendTransfer() failed");
            console.log(" iota.lib.js returns this error:");
            console.log(e);
            process.exit(1);
        }
        spam_count++;
        var ellapsed = performance()-spam_starttime;
        spam_timesum += ellapsed;
        if (VALUESPAM_ON == true) {
            console.log("*INFO  Spam type: value , spam count: "+spam_count+", last spam took "+Math.floor(ellapsed/1000)+" seconds, search depth was "+depth);
        } else {
            console.log("*INFO  Spam type: message, spam count: "+spam_count+", last spam took "+Math.floor(ellapsed/1000)+" seconds, search depth was "+depth);
        }
        console.log("*INFO  Average spam duration: "+Math.floor(spam_timesum/1000)/spam_count+" seconds (deliberate delays not included.)"); 
        lock_spam = false;
    });
}


function onMyTimer() {
    if (lock) return;
    lock = true;
    // First, check if synced 
    if (!iri_is_synced) {
        iota.api.getNodeInfo(function(e,s) {
             if (e) {
                 console.log("*INFO  Waiting for iri connection.");
                 lock = false;
                 return;
             }
             var milestone = s.latestMilestone;
             var solidMilestone = s.latestSolidSubtangleMilestone;
             current_milestone_idx = s.latestMilestoneIndex;
             if (milestone == allnine || solidMilestone == allnine || solidMilestone < milestone) {
                 console.log("*INFO  Waiting for synchronization with network. Latest milestone idx: "+current_milestone_idx+". Latest solid milestone idx: "+solidMilestone );
                 lock = false;
                 return;
             } 
             else {
                 if (wanted_milestone > 0) {
                     console.log("wanted milestone is "+wanted_milestone);
                     if (s.latestSolidSubtangleMilestoneIndex < wanted_milestone) {
                         console.log("*INFO  Waiting for synchronization with network. Latest milestone idx: "+current_milestone_idx+". Latest solid milestone idx: "+s.latestSolidSubtangleMilestoneIndex );
                     }
                     else {
                         console.log("*INFO  Synchronized! Latest milestone idx: "+current_milestone_idx+". Latest solid milestone idx: "+s.latestSolidSubtangleMilestoneIndex ); iri_is_synced = true;
                     }
                     lock = false;
                 }
                 else { 
                     console.log("*INFO  Synchronized! Latest milestone idx: "+current_milestone_idx+". Latest solid milestone idx: "+s.latestSolidSubtangleMilestoneIndex ); iri_is_synced = true;
                     lock = false;
                 }
             }
             // synced is true
        });
        enable_spam = false;
    }

    if (REPEATER_ON==true) {
        if (ignore_tips == null) {
            // at startup
            collect_tips_at_startup();
        }
        else {
            // when running
           collect_fresh_arrived();
        }
    }
    else {
        lock = false;
    }

    if (iri_is_synced && enable_spam == true) {
        if (lock_spam == false) {
            lock_spam = true;
            var now = performance();
            if (SPAM_ON==true && now>next_spam_time) {
                next_spam_time = now+SPAM_FREQUENCY*1000;
                spam_spam_spam();
            }
            else {
                lock_spam = false;
            }
        }
    }
    
    if (iri_is_synced && enable_spam == false) {
        if (SPAM_ON == true && VALUESPAM_ON == true) {
            console.log('*INFO  Checking the seed for any balance...');
            iota.api.getInputs(USER_SEED, function(e,s) {
                if(s) {
                    var inputs = s.inputs;

                    if (inputs.length > 0) {
                        balance_found = true;

                        transfers = [{
                            'address': inputs[0].address,
                            'value': inputs[0].balance,
                            'message': SPAM_MESSAGE,
                            'tag': SPAM_TAG
                        }];
                        console.log('*INFO  Value spamming started from/to address ' + inputs[0].address + ' with '  + inputs[0].balance+' iota.');
                    } else {
                        console.log('*INFO  No balance was found in the seed!')
                        process.exit(1);
                    }

                    enable_spam = true;

                } else {
                    console.log(e);
                    process.exit(1);
                }
            });
        } else {
            enable_spam = true;
        }
    }
}

if(VALUESPAM_ON == true && SPAM_ON == true) {
    console.log("RUNNING REPEATER: "+REPEATER_ON+", RUNNING VALUE SPAMMER: "+VALUESPAM_ON);
}
else  {
    console.log("RUNNING REPEATER: "+REPEATER_ON+", RUNNING MESSAGE SPAMMER: "+SPAM_ON);
}

onMyTimer();
setInterval(onMyTimer, 3000);

