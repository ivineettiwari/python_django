$(document).ready(function () {
    getURL();
});

document.getElementById("hideButton").addEventListener("click", function () {
    var anchor = document.getElementById("dataTable");
    anchor.classList.toggle("hidden");
});

function getURL() {
    $.ajax({
        url: "ticket_list",
        type: "POST",
        success: function (response) {
            // Clear existing table rows
            $("#dataTable tbody").empty();

            // Add new table rows with updated data
            $.each(response['message'], function (index, data) {
                $("#dataTable tbody").append("<tr><td>" + data.id + "</td><td>" + data.subject + "</td><td>"
                    + data.discription + "</td><td>"
                    + data.ticket_type + "</td><td>"
                    + `<button id=${index}>Delete</button>` + "</td></tr>");
            });
        },
        error: function (xhr, errmsg, err) {
            console.log(xhr.status + ": " + xhr.responseText);
            // Handle errors here
        }
    });
}

function callAPI() {
    let data = {
        subject: "",
        discription: "",
        type: "",
    };
    data["subject"] = document.getElementById("input-data-subject").value;
    data["discription"] = document.getElementById(
        "input-data-discription"
    ).value;
    data["type"] = document.getElementById("ticket-type").value;
    data["subject"] = data["subject"] ? data["subject"] : null;
    if (data["subject"] == "") {
        alert("Subject must be filled out");
        return false;
    }
    if (data["discription"] == "") {
        alert("Description must be filled out");
        return false;
    }

    fetch("http://127.0.0.1:8000/userdata", {
        method: "POST",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            message: data,
        }),
        json: true,
    })
        .then((response) => response.json())
        .then((resp) => {
            getURL()
        });
}

const table = document.querySelector("table");
table.addEventListener("click", (e) => {
    if (e.target.localName == "button") {
        let data = {
            id: parseInt(e.target.id),
            discription: "New DATA"
        };

        fetch("http://127.0.0.1:8000/updatedelete", {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                message: data,
                status: 'delete'
            }),
            json: true,
        })
            .then((response) => response.json())
            .then((resp) => {
                getURL()
            });
    }
});