//Name:Emhenya Supreme, Student Number:3132969

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('concertForm');
    const resultsDiv = document.getElementById('results');
    const downloadButton = document.getElementById('downloadButton');

    filterButton.addEventListener('click', async () => {
        console.log('filter button pressed');
        const searchArtist = document.getElementById('searchArtist').value;
        console.log(searchArtist);
        try {
            const response = await fetch(`/concerts?artist=${encodeURIComponent(searchArtist)}`);
            if (!response.ok) throw new Error(`Error: ${response.status}`);
    
            const concerts = await response.json();
            console.log(concerts);
            resultsDiv.innerHTML = '';
    
            if (concerts.length === 0) {
                resultsDiv.innerHTML = `<p>No concerts found for "${searchArtist}" in Database.</p>`;
            } else {
                const list = document.createElement('ul');
                concerts.forEach((concert) => {
                    const listItem = document.createElement('li');
                    listItem.textContent = `${concert.artist} - ${concert.location} on ${concert.date}`;
                    list.appendChild(listItem);
                });
                resultsDiv.appendChild(list);
            }
        } catch (error) {
            resultsDiv.innerHTML = `<p>Error filtering concerts: ${error.message}</p>`;
        }
    });

    const dbDownloadButton=document.getElementById('dbDownloadButton');

    dbDownloadButton.addEventListener('click',async()=>{
        try{
            const response=await fetch('/downloadSearchResults');
            if(!response.ok){
                throw new Error(`Error:${response.status}`);
            }

            const blob = await response.blob(); 
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'search_results.txt'; 
            link.click();
            window.URL.revokeObjectURL(url); 
        } catch (error) {
            console.error('Error downloading the file:', error);
        }
    });

document.getElementById('LogOutButton').addEventListener('click', () => {
    fetch('/logout', {
        method: 'POST',
        credentials: 'same-origin'
    })
    .then(response => {
        if (response.redirected) {
            window.location.href = '/login';
        } else {
            console.error('Logout failed.');
            alert('Failed to log out. Please try again.');
            }
        })
        .catch(error => {
            console.error('Error during logout:', error);
        });
});

    form.addEventListener('submit', async (e) => {
        e.preventDefault(); 

        const artist = document.getElementById('artist').value;
        const location = document.getElementById('country').value; 

        try {
            const response = await fetch('/submit', {  
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ artist, location})  
            });

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const html = await response.text(); 
            resultsDiv.innerHTML = html; 

            
            downloadButton.style.display = 'block';

        } catch (error) {
            resultsDiv.innerHTML = '<p>Error fetching concert data. Please try again later.</p>';
            console.error('Error:', error);
            downloadButton.style.display = 'none';
        }
    });
});

