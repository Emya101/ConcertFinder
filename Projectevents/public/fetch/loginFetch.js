document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username=document.getElementById('username').value;
    const password=document.getElementById('password').value;

    try{
        const response=await fetch('/login',{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify({username,password})
        });

        if(response.ok){
            window.location.href='/concertFinder';
        }
        else{
            const message=await response.text();
            document.getElementById('errorMessage').textContent=message;
        }
    }
    catch(error){
        console.error('Error during login:',error);
    }
});