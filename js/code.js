/* if (location.protocol != 'https:') {
    location.href = 'https:' + window.location.href.substring(window.location.protocol.length);
} */


class User {
    constructor(username) {
        // Generate ID & make sure it's not taken.
        var id = users.length;
        while (get_user(id) > 0) id++;
        this.id = id;
        this.username = username;
        this.meters = 0;
        this.kr = 0;
        this.active = false;
        this.credit = 0;
    }

    reset() {
        this.meters = 0;
        this.kr = 0;
        this.active = false;
    }

    get_status() {
        if (this.active) return "active";
        return "paused";
    }

    get_km() {
        return Math.round((this.meters / 1000) * 10) / 10;
    }
}

var showing_settings = false;
var loading_users = false;
var users = [];
var active_users = 0;
var gps_runing = false;
var total_money = 0;
var canvas = document.getElementById("canvas");
var ctx = canvas.getContext("2d");

var settings = {
    milage_cost: 1.3,
    total_distance: 0, // Meters
    last_pos: undefined /* Coords */ ,
    display_share: false,
    total_rides: 0
}

load();
calculate_share();
display_users();

window.onload = () => {
    set_last_pos();
    run_gps();
}

function set_last_pos() {
    navigator.geolocation.getCurrentPosition(position => {
        settings.last_pos = position.coords;
        set_gps_status(2); // Good!
    }, e => error(e));
}

function close_receipt() {
    canvas.style.visibility = "hidden";
    generating_receipt = false;
}

var generating_receipt = false;

function get_receipt() {
    generating_receipt = true;
    generate_receipt();
}

function credit_user(user_id) {
    var user = users[get_user(user_id)];
    var amount = prompt("How much would like to credit this user?", 0);
    if (!isNaN(Number(amount))) {
        // If it's a number
        user.credit = Number(user.credit) + Number(amount);
        save();
    }
}

function get_user_pay(user){
    var to_pay = Math.ceil(user.kr);
    var credit = user.credit;
    if(credit > 0){
        // User has credits
        if(to_pay > credit){
            to_pay -= credit;
            credit = 0;
        } else if(to_pay < credit) {
            credit -= to_pay;
            to_pay = 0;
        } else {
            credit = 0;
            to_pay = 0;
        }
    }

    return {
        credit_used: user.credit - credit,
        credit_left: credit,
        to_pay: to_pay
    }
}


function generate_receipt() {
    canvas.style.visibility = "visible";
    canvas.width = document.body.offsetWidth;
    canvas.height = document.body.offsetHeight;

    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "black"; // Text color
    ctx.font = "30px Monaco";
    ctx.textAlign = "center";
    ctx.fillText("Fair Fare", canvas.width / 2, 50);
    ctx.font = "13px Monaco";
    ctx.fillText("Ride receipt", canvas.width / 2, 77);

    var x_pos = canvas.width / 2 - 140;


    var y_height = 170;
    ctx.textAlign = "left";

    ctx.fillText("Ride Nr. " + settings.total_rides, x_pos, 120);

    var date_arr = new Date().toString().split(" ");
    ctx.fillText(date_arr[4].substr(0, date_arr[4].lastIndexOf(":")) + " - " + date_arr[2] + " " + date_arr[1] + " " + date_arr[3], x_pos, 145)

    ctx.textAlign = "left";
    for (user of users) {
        if (user.meters === 0) continue; // Don't display users who haven't traveled.
        var to_pay = get_user_pay(user);
        y_height += 30;
        var output_str = user.username;
        if(user.credit > 0) output_str += " (" + to_pay.credit_used + ":-)";
        while (ctx.measureText(output_str).width < 130) output_str += ".";
        output_str += Math.round((user.meters / 1000) * 10) / 10 + "km";
        while (ctx.measureText(output_str).width < 250) output_str += ".";
        output_str += to_pay.to_pay + ":-"
        ctx.fillText(output_str, x_pos - 5, y_height);
    }

    ctx.textAlign = "left";

    ctx.fillText("Total " + Math.round((settings.total_distance / 1000) * 10) / 10 + "km, " + Math.ceil(total_money) + ":-" + ", Rate " + settings.milage_cost + " SEK/KM", x_pos, y_height + 50);
    ctx.fillText("Have a fair fare! fair.livfor.it", x_pos, y_height + 80);
    if (generating_receipt) requestAnimationFrame(generate_receipt);
    else close_receipt();
}

// For DEMO purposes
function demo_move(km) {
    distance = km;
    settings.total_distance += distance * 1000; // Meters
    for (user of users) {
        if (user.active) {
            user.meters += distance * 1000; // Add distance to all active accounts.
            user.kr += (settings.milage_cost * distance) / active_users;
        }
    }
    save();
    calculate_share();
    if (!showing_settings) display_users();
}

function run_gps() {
    if (gps_runing) return;
    set_gps_status(1);

    navigator.geolocation.watchPosition(position => {
        gps_runing = true;
        if (settings.last_pos === undefined) return;
        var distance = calculateDistance(settings.last_pos.latitude, settings.last_pos.longitude, position.coords.latitude, position.coords.longitude);


        calculate_share();
        settings.last_pos = position.coords;

        if (active_users > 0) {
            settings.total_distance += distance * 1000; // Meters
            for (user of users) {
                if (user.active) {
                    user.meters += distance * 1000; // Add distance to all active accounts.
                    user.kr += (settings.milage_cost * distance) / active_users;
                }
            }
        }
        save();

        calculate_share();
        if (!showing_settings) display_users();
    }, e => {
        error(e);
    });
}

function error(e) {
    console.log(e);
    alert("GPS Error!");
    set_gps_status(0);
    gps_runing = false;
}

function set_gps_status(code) {
    // Status codes: 0: failure, 1: Unknown or retrying, 2: Good connection
    color = "rgb(236, 68, 68)";
    if (code === 1) color = "rgb(248, 176, 42)";
    else if (code === 2) color = "rgb(79, 255, 48)";

    document.getElementById("status-light").style.background = color;
}

function calculate_share() {
    active_users = 0;
    total_money = 0;
    for (user of users) {
        if (user.active) {
            active_users++;
        }
        total_money += user.kr;
    }

    for (user of users) {
        user.pay_share = ((Math.round((user.kr / total_money) * 10) / 10) * 100) + "%";
        if (user.pay_share.indexOf("NaN") !== -1) user.pay_share = "0%";
    }
}

function display_settings(show) {
    var animate = true;
    showing_settings = !showing_settings; // Toggle settings
    if (show) {
        showing_settings = true;
        animate = false;
    }
    if (!show && show !== undefined) showing_settings = false;

    if (showing_settings) {
        document.getElementById("settings-container").innerHTML = "";
        var settings_DOM = create_settings_DOM(animate);
        document.getElementById("settings-container").appendChild(settings_DOM);

        setTimeout(() => {
            settings_DOM.style.visibility = "visible";
            if (animate) settings_DOM.style.top = "0px";
        }, 10)
    } else {
        document.getElementsByClassName("settings")[0].style.top = -document.getElementsByClassName("settings")[0].offsetHeight - 60 + "px";
        setTimeout(() => document.getElementById("settings-container").innerHTML = "", 500);
        display_users();
    }
}

function reset_all() {
    if (confirm("Are you sure you want to end the ride?")) {
        for (user of users) {
            var pay = get_user_pay(user);
            if(pay.credit_used > 0){
                if(confirm(user.username + " should be charged " + pay.credit_used + " credits, do you want to proceed?")){
                    user.credit -= pay.credit_used;
                }
            }
            user.reset();
        }
        settings.total_rides++;
        settings.total_distance = 0;
        settings.last_pos = undefined;
        set_last_pos();
        save();
    }

}

function switch_display_mode(el) {
    settings.display_share = !settings.display_share;
    if (settings.display_share) el.innerText = "DISPLAY SEK";
    else el.innerText = "DISPLAY SHARE";
    save();
}

function create_settings_DOM(animate) {

    var settings_DOM = document.createElement("div");
    settings_DOM.innerHTML = "<span id='sek-title'>SEK / KM (Cost / 1000m)</span>";
    settings_DOM.classList.add("settings");

    var milage_input = document.createElement("input");
    milage_input.type = "number";
    milage_input.placeholder = "1,3";
    milage_input.setAttribute("value", settings.milage_cost);
    milage_input.setAttribute("oninput", "save()"); // idk why the actual solution doesn't work. i.e .oninput = e => {}
    milage_input.id = "milage_input";

    var reset_button = document.createElement("button");
    reset_button.classList.add("btn");
    reset_button.classList.add("reset-button");
    reset_button.setAttribute("onclick", "reset_all()")
    reset_button.innerText = "END RIDE";

    /*  var switch_btn = document.createElement("button");
     switch_btn.classList.add("btn");
     switch_btn.classList.add("switch-button");
     switch_btn.setAttribute("onclick", "switch_display_mode(this)")
     switch_btn.innerText = "DISPLAY SHARE";
     if (settings.display_share) switch_btn.innerText = "DISPLAY SEK"; */

    var receipt_button = document.createElement("button");
    receipt_button.classList.add("btn");
    receipt_button.classList.add("switch-button");
    receipt_button.setAttribute("onclick", "get_receipt()")
    receipt_button.innerText = "GET RECEIPT";


    settings_DOM.appendChild(milage_input);
    //settings_DOM.appendChild(switch_btn);
    settings_DOM.appendChild(receipt_button);
    settings_DOM.appendChild(reset_button);
    settings_DOM.innerHTML += "Delete users";

    for (i = 0; i < users.length; i++) {
        var user = document.createElement("div");
        user.classList.add("user-delete");

        var username = document.createElement("span");
        username.classList.add("delete-username");
        username.innerText = users[i].username;
        username.id = users[i].id;

        var credit_button = document.createElement("button");
        credit_button.classList.add("btn");
        credit_button.classList.add("credit-button")
        credit_button.innerText = "$";
        credit_button.id = users[i].id;
        credit_button.onclick = (e) => {
            credit_user(e.target.id);
        }

        var delete_button = document.createElement("button");
        delete_button.classList.add("btn");
        delete_button.classList.add("delete");
        delete_button.innerText = "DELETE";
        delete_button.id = users[i].id;

        delete_button.onclick = (e) => {
            delete_user(e.target.id);
        }

        user.appendChild(username);
        user.appendChild(delete_button);
        user.appendChild(credit_button);

        settings_DOM.appendChild(user);
    }

    if (animate) settings_DOM.style.top = -get_height_of_DOM(settings_DOM) + "px";
    return settings_DOM;
}

function get_height_of_DOM(el) {
    el.style.visibility = "hidden";
    document.body.appendChild(el);
    var height = el.clientHeight;
    el.remove();
    return height;
}

function display_users() {

    users.sort(prioritize_active);
    document.getElementById("users").innerHTML = "";

    for (user of users) {
        document.getElementById("users").appendChild(create_DOM(user));
    }
}

function toggle_user(user_id) {
    users[get_user(user_id)].active = !users[get_user(user_id)].active;
    calculate_share();
    display_users();
    save();
}

function get_user(user_id) {
    for (i = 0; i < users.length; i++) {
        if (users[i].id == user_id) return i;
    }
    return -1;
}

function add_user() {
    username = prompt("Enter name");
    if (username) users.push(new User(username));
    display_users();
    save();
}

function delete_user(user_id) {
    users.splice(get_user(user_id), 1);
    display_settings(true);
    save();
}

function save() {
    calculate_share();
    if (showing_settings) {
        settings.milage_cost = Number(document.getElementById("milage_input").value);
    }

    localStorage.setItem("users", JSON.stringify(users));
    localStorage.setItem("settings", JSON.stringify(settings));
}

function load() {
    // Load JSON's from Local storage
    loaded_users = JSON.parse(localStorage.getItem("users"));
    loaded_settings = JSON.parse(localStorage.getItem("settings"));
    // Load users from JSON and assign class
    if (loaded_users !== null)
        for (user of loaded_users) {
            var new_user = new User("?");
            for (property in user) {
                new_user[property] = user[property];
            }
            users.push(new_user);
        }
    if (loaded_settings !== null) settings = loaded_settings;
}

function create_DOM(user) {
    var user_display = document.createElement("div");
    var name_and_cost = document.createElement("div");
    var name = document.createElement("span");
    var cost = document.createElement("span");
    var button = document.createElement("button");

    user_display.classList.add("user-display");
    name_and_cost.classList.add("name-and-cost");
    name.classList.add("name");
    cost.classList.add("cost");
    button.classList.add("btn");

    name.innerText = user.username;
    if (user.credit > 0) name.innerHTML += "<span style='color:rgb(74, 214, 74);'> (" + user.credit + ":-)</span>";
    if (settings.display_share) cost.innerHTML += user.pay_share;
    else cost.innerHTML += Math.ceil(user.kr) + ":-";
    cost.innerHTML += "<span style='color:grey;'>, " + user.get_km() + "km</span>";

    button.innerText = user.get_status().toUpperCase();
    if (user.active) button.innerText += " " + Math.round(100 / active_users) + "%";
    button.classList.add(user.get_status());
    button.id = user.id;
    button.addEventListener("click", e => {
        toggle_user(e.target.id);
    })

    name_and_cost.appendChild(name);
    name_and_cost.appendChild(cost);

    user_display.appendChild(name_and_cost);
    user_display.appendChild(button);

    return user_display;
}


function prioritize_active(a, b) {
    if (a.active !== b.active && a.active)
        return -1; // Prioritize active users
    if (a.active === b.active)
        return b.kr - a.kr; // If their activate status is the same, prioritize KR amount
    return 0;
}


function calculateDistance(lat1, lon1, lat2, lon2) {
    var R = 6371; // km
    var dLat = (lat2 - lat1).toRad();
    var dLon = (lon2 - lon1).toRad();
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1.toRad()) * Math.cos(lat2.toRad()) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c;
    return d;
}
Number.prototype.toRad = function () {
    return this * Math.PI / 180;
}