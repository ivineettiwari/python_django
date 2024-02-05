function callAPI(){
    const userListElement = document.getElementById("userList");

    // Fetch user data from the API
    fetch('http://127.0.0.1:8000/data')
        .then(response => response.json())
        .then(users => {
            users = JSON.parse(users.data);
            // Iterate through the list of users and create a card for each
            users.forEach(user => {
                const userCard = document.createElement("li");
                userCard.className = "userCard";
                userCard.innerHTML = `
                    <h2>${user.name}</h2>
                    <p><strong>Email:</strong> ${user.email}</p>
                    <p><strong>Username:</strong> ${user.username}</p>
                    <p><strong>Phone:</strong> ${user.phone}</p>
                `;
                userListElement.appendChild(userCard);
            });
        })
        .catch(error => {
            console.error('Error fetching user data:', error);
        });
};