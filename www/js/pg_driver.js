//
// javascript page handler for driver.html
//
(function(global) {
'use strict';
var dlinkDefault = {ip:"192.168.0.10", url: "/video.cgi"};
var piCam = {ip:"10.49.15.10:5080", url: "/cam.mjpg"};
var axis1 = {ip:"10.49.15.11", url: "/mjpg/video.mjpg"};
var axis2 = {ip:"10.49.15.12", url: "/mjpg/video.mjpg"};
var dlink4915 = {ip:"admin:@10.49.15.13", url: "/video.cgi"};
var usbCam = {ip:"10.49.15.2:1180", url: "/?action=stream"};
var driver = {
    forwardCam: piCam,
    reverseCam: dlink4915,
    pageLoaded: function(targetElem, html) {
        targetElem.innerHTML = html;

        // first initialize selectors from network tables.
        $(".selector").each(function() {
            var key = $(this).attr("id");
            // var ntkey = "/SmartDashboard/" + key;
            var val = app.getValue(key);
            $(this).val(val);
        });

        // now update network tables on changes
        $(".selector").change(function() {
            var value = $(this).val();
            var key = $(this).attr("id");
            app.putValue(key, value);
        });

        $(".command").click(function() {
            var key = $(this).attr("data-command");
            app.putValue(key + "/running", true);
        });

        this.changeCamera();
    },

    onNetTabChange: function(key, value, isNew) {
        switch(key) {
            case "/SmartDashboard/AutoStrategy":
                var sel = document.getElementById("AutoStrategy");
                if(sel) {
                    sel.value = value;
                }
                break;
            case "/SmartDashboard/AutoStrategyOptions":
                // we assume that value is a comma separated list
                var options = value.split(",").sort();
                var sel = document.getElementById("AutoStrategy");
                if(sel) {
                    $(sel).empty();
                    for(let i=0;i<options.length;i++) {
                        var opt = document.createElement("option");
                        opt.value = options[i];
                        opt.innerHTML = opt.value;
                        sel.appendChild(opt);
                    }
                }
                break;
            case "/SmartDashboard/CameraView":
                this.changeCamera();
                break;
            case "/SmartDashboard/ReverseEnabled":
                if(value === "Enabled") {
                    $("#fwdrev").text("Reverse");
                    $("#fwdrevimg").html('<img width="20px" src="/images/reverse.gif"></img>');
                }
                else {
                    $("#fwdrev").text("Forward");
                    $("#fwdrevimg").html('<img width="20px" src="/images/forward.gif"></img>');
                }
                this.changeCamera(value);
                break;
            case "/FMSInfo/IsRedAlliance":
                var el = document.getElementById("alliance");
                if(el) {
                    switch(value)
                    {
                    case false:
                        $(el).html("<span class=\"blueAlliance\">Blue Alliance</span>");
                        break;
                    case true:
                        $(el).html("<span class=\"redAlliance\">Red Alliance</span>");
                        break;
                    default:
                        $(el).html("<span class=\"unknownAlliance\">Unknown Alliance</span>");
                        break;
                    }
                }
                break;
            case "/FMSInfo/StationNumber":
                var el = document.getElementById("allianceStation");
                $(el).text(value);
                break;
            case "/FMSInfo/GameSpecificMessage":
                var el = document.getElementById("fmsGameMSG");
                // 2018: 3 chars "LRL", means:
                //    our switch on Left
                //    our scale on Right
                //    defense for their switch on Left
                $(el).text(value);
                break;
            case "/FMSInfo/ReplayNumber":
                break;
            case "/FMSInfo/FMSControlData":
                break;
            case "/FMSInfo/EventName":
                break;
            case "/FMSInfo/MatchType":
                break;
            case "/FMSInfo/MatchNumber":
                break;
            case "/FMSInfo/.type":
                break;

            case "/SmartDashboard/AllianceStation":
                console.log("ignoring " + key + " in favor of /FMS/IsRedAlliance");
                break; 
                // $(`#AutoStrategy option:contains(${value})`).attr("selected", true);
                var el = document.getElementById("AllianceStation");
                if(el) {
                    switch(value)
                    {
                    case "Blue":
                        $(el).removeClass("unknownAlliance")
                             .removeClass("redAlliance")
                             .addClass("blueAlliance");
                        break;
                    case "Red":
                        $(el).removeClass("unknownAlliance")
                             .removeClass("blueAlliance")
                             .addClass("redAlliance");
                        break;
                    default:
                        $(el).removeClass("blueAlliance")
                             .removeClass("redAlliance")
                             .addClass("unknownAlliance");
                        break;
                    }
                    el.value = value;
                }
                break;
            default:
                if(key.indexOf("/FMS") == 0)
                {
                    console.log(key + ":" + value);
                }
                break;
        }
    },
    changeCamera: function(reverseEnabled) {
        var camhtml, cam, view = app.getValue("CameraView", "Auto");
        var camdiv = $("#camera");
        if(!reverseEnabled) {
            reverseEnabled = app.getValue("ReverseEnabled", "Disabled");
        }
        camdiv.removeClass("nocam")
              .removeClass("fwdcam")
              .removeClass("revcam");
        if(view === "Auto") {
            if(!app.robotConnected)
                view = "None";
            else
            if (reverseEnabled === "Enabled")
                view = "Reverse";
            else
                view = "Forward";
        }
        switch(view) {
            case "Forward":
                camdiv.addClass("fwdcam");
                cam = this.forwardCam;
                break;
            case "Reverse":
                camdiv.addClass("revcam");
                cam = this.reverseCam;
                break;
            default:
                camdiv.addClass("nocam");
                cam = null;
                break;
        }
        if(cam) {
            camhtml = `<img style="width:100%" src="http://${cam.ip}${cam.url}"></img>`;
        }
        else {
            camhtml = "<!-- empty -->";
        }

        app.logMsg("changeCamera: " + camhtml);
        $("#camera").html(camhtml);
    }
};

global.app.setPageHandler("driver", driver);
})(window);
