class User{
    constructor(username){
        // Generate ID & make sure it's not taken.
        var id = users.length;
        while(get_user(id) > 0) id++;
        this.id = id;
        this.username = username;
        this.meters = 0;
        this.kr = 0;
        this.active = false;
    }

    reset(){
        this.meters = 0;
        this.kr = 0;
        this.active = false;
    }

    get_status(){
        if(this.active) return "active";
        return "paused";
    }

    get_km(){
        return Math.round(this.meters/10000)*10;
    }
}

var showing_settings = false;
var users = [];
var settings = {
    milage_cost: 1.3,
    distance: 0,
    last_pos: undefined /* Coords */
}

load();
display_users();

window.onload = () => {
    run_gps();
} 

function run_gps(){
    if(settings.last_pos === undefined){
        navigator.geolocation.getCurrentPosition(position => {
            settings.last_pos = position.coords;
            set_gps_status(2); // Good!

            navigator.geolocation.watchPosition(position => {
                var distance = calculateDistance(settings.last_pos.latitude, settings.last_pos.longitude, position.coords.latitude, position.coords.longitude);
            
            });
        }, e => {
            error(e);
            run_gps();
        })
    }
}

function error(e){
    console.log(e);
    alert("GPS Error!" + e.code);
    set_gps_status(0);
}

function set_gps_status(code){
    // Status codes: 0: failure, 1: Unknown or retrying, 2: Good connection
    color = "rgb(236, 68, 68)";
    if(code === 1) color = "rgb(248, 176, 42)";
        else if(code === 2) color = "rgb(79, 255, 48)";

    document.getElementById("status-light").style.background = color;
}

function calculateCost(){
    for(user of users){
        user.kr = Math.round((user.meters/1000) * settings.milage_cost)
    }
}

function display_settings(show){
    calculateCost();
    showing_settings = !showing_settings; // Toggle settings
    if(show) showing_settings = true;
    if(!show && show !== undefined) showing_settings = false;

    if(showing_settings){
        document.getElementById("users").innerHTML = "";
        document.getElementById("users").appendChild(create_settings_DOM());
    } else {
        display_users();
    }
}

function reset_all(){
    if(confirm("Are you sure you want to end the ride?")){

        for(user of users){
            user.reset();
            settings.distance = 0;
            settings.last_pos = undefined;
        }
    }
    
}

function create_settings_DOM(){

    var settings_DOM = document.createElement("div");
        settings_DOM.innerHTML = "SEK / KM (Cost / 1000m)";
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
    
        settings_DOM.appendChild(milage_input);
        settings_DOM.appendChild(reset_button);
        settings_DOM.innerHTML += "Delete users";

    for(i = 0; i < users.length; i++){
        var user = document.createElement("div");
            user.classList.add("user-delete");
        
        var username = document.createElement("span");
            username.classList.add("delete-username");
            username.innerText = users[i].username;
            username.id = users[i].id;
            
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

        settings_DOM.appendChild(user);
    }

    return settings_DOM;
}

function display_users(){
    users.sort(prioritize_active);
    document.getElementById("users").innerHTML = "";
    for(user of users){
        document.getElementById("users").appendChild(create_DOM(user));
    }
}

function toggle_user(user_id){
    users[get_user(user_id)].active = !users[get_user(user_id)].active;
    display_users(); 
    save();
}

function get_user(user_id){
    for(i = 0; i < users.length; i++){
        if(users[i].id == user_id) return i;
    }
    return -1;
}

function add_user(){
    username = prompt("Enter name");
    if(username) users.push(new User(username));
    display_users();
    save();
}

function delete_user(user_id){
    users.splice(get_user(user_id), 1);
    display_settings(true);
    save();
}

function save(){
    if(showing_settings){
        settings.milage_cost = Number(document.getElementById("milage_input").value);
    }

    localStorage.setItem("users", JSON.stringify(users));
    localStorage.setItem("settings", JSON.stringify(settings));
}

function load(){
    // Load JSON's from Local storage
    loaded_users = JSON.parse(localStorage.getItem("users"));
    loaded_settings = JSON.parse(localStorage.getItem("settings"));
    // Load users from JSON and assign class
    if(loaded_users !== null) for(user of loaded_users){
        var new_user = new User("?");
        for(property in user){
            new_user[property] = user[property];
        }
        users.push(new_user);
    }
    if(loaded_settings !== null) settings = loaded_settings;
}

function create_DOM(user){
    var user_display = document.createElement("div");
    var name_and_cost = document.createElement("div");
    var name = document.createElement("span");
    var cost = document.createElement("cost");
    var button = document.createElement("button");

    user_display.classList.add("user-display");
    name_and_cost.classList.add("name-and-cost");
    name.classList.add("name");
    cost.classList.add("cost");
    button.classList.add("btn");

    name.innerText = user.username;
    cost.innerText = user.get_km() + "km, " + user.kr + ":-";
    
    button.innerText = user.get_status().toUpperCase();
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


function prioritize_active(a,b) {
    if (a.active)
      return -1;
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
  Number.prototype.toRad = function() {
    return this * Math.PI / 180;
  }