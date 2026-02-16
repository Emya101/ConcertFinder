//Name:Emhenya Supreme, Student Number:3132969
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcryptjs');
const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const nunjucks = require('nunjucks');
const app = express();
const Port = 3000;

require('dotenv').config();
const ticketmasterApiKey= process.env.TICKETMASTER_API_KEY;
const uri = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PW}@cluster0.nfr0e.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

let loggedInUsername = null;


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'admin-secret',
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({
        mongoUrl: uri
    }),
    cookie: { secure: false }

}));


app.use(['/concertFinder', '/', '/login'], (req, res, next) => {
    if (req.method === 'GET') {

        if (req.path === "/login") {
            if (!req.session.pageVisits) {
                req.session.pageVisits = 0;
            }

            req.session.pageVisits++;

            if (!req.session.pageVisitStartTime) {
                req.session.pageVisitStartTime = new Date();
            }

            const visitTime = new Date();

            const hours = String(visitTime.getHours()).padStart(2, '0');
            const minutes = String(visitTime.getMinutes()).padStart(2, '0');
            const seconds = String(visitTime.getSeconds()).padStart(2, '0');

            console.log(`Page Visits: ${req.session.pageVisits}`);
            console.log(`Page accessed at: ${hours}:${minutes}:${seconds}`);
        }
        else {
            if (!req.session.pageVisits) {
                req.session.pageVisits = 0;
            }

            req.session.pageVisits++;

            if (!req.session.pageVisitStartTime) {
                req.session.pageVisitStartTime = new Date();
            }
            const visitTime = new Date();

            const hours = String(visitTime.getHours()).padStart(2, '0');
            const minutes = String(visitTime.getMinutes()).padStart(2, '0');
            const seconds = String(visitTime.getSeconds()).padStart(2, '0');

            console.log(`Page Visits: ${req.session.pageVisits}`);
            console.log(`Page accessed at: ${hours}:${minutes}:${seconds}`);
        }
    }
    next();
});


nunjucks.configure(path.join(__dirname, 'views'), {
    autoescape: true,
    express: app
});

app.set('view engine', 'njk'); // ADD THIS

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});


mongoose.connect(uri)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error: ', err));

const concertSchema = new mongoose.Schema({
    artist: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    date: { type: String, required: true, trim: true },
});

concertSchema.index({ artist: 1, location: 1, date: 1 }, { unique: true });

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
});

const Concert = mongoose.model('Concert', concertSchema);
const User = mongoose.model('User', userSchema);

app.get('/concerts', async (req, res) => {
    const { artist } = req.query;
    try {
        const query = {};
        if (artist) {
            query.artist = { $regex: artist, $options: 'i' };
        }

        const concerts = await Concert.find(query);
        res.status(200).json(concerts);

    }
    catch (error) {
        res.status(500).send('Error retrieving concerts: ' + error.message);
    }
})

async function fetchConcertData(artist, location) {
    const apiUrl = `https://app.ticketmaster.com/discovery/v2/events.json`;
    const params = new URLSearchParams({
        apikey: ticketmasterApiKey,
        keyword: artist,
        countryCode: location
    });

    try {
        const response = await fetch(`${apiUrl}?${params.toString()}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();
        if (data._embedded && data._embedded.events.length > 0) {
            return data._embedded.events
                .filter(event => event.classifications && event.classifications.some(c => c.segment && c.segment.name === "Music"))
                .map(event => {
                    const venue = event._embedded.venues[0];
                    return {
                        name: event.name,
                        date: event.dates.start.localDate,
                        venue: venue.name,
                        city: venue.city.name,
                        state: venue.state ? venue.state.stateCode : "",
                        ticketUrl: event.url
                    };
                });
        } else {
            console.log(`No concerts found for ${artist} in ${location}`);
            return [];
        }
    } catch (error) {
        console.error('Error fetching concert data:', error);
        throw error;
    }
}

async function renderConcerts(res, username, artist, location, concerts) {
    if (concerts.length > 0) {
        const concertDetails = concerts.map(concert =>
            `- ${concert.name} at ${concert.venue} on ${concert.date}\n  More info: ${concert.ticketUrl}`
        ).join('\n\n');

        const filePath = path.join(__dirname, 'concert_results.txt');

        try {
            console.log(`Writing concert results to ${filePath}`);
            fs.writeFileSync(filePath, `Made for ${username}\nConcerts for ${artist} in ${location}:\n\n${concertDetails}`);
            console.log(`Concert results written to ${filePath}`);

            // 👇 ADD NEW TRY CATCH HERE
            try {
                res.render('concerts.njk', { username, artist, location, concerts });
            } catch (renderErr) {
                console.error("Template render failed:", renderErr);
                return res.status(500).send("Template rendering failed");
            }

        } catch (err) {
            console.error('Error writing to file:', err);
            res.status(500).send('Error writing to file');
        }

    } else {
        res.render('noConcerts.njk', { artist, location });
    }
}
app.post('/saveConcert', async (req, res) => {
    const { artist, location } = req.body;

    try {
        const concerts = await fetchConcertData(artist, location);

        if (concerts.length === 0) {
            return res.status(404).send(`No concerts found for ${artist} in ${location}`);
        }

        const savedConcerts = await Promise.all(concerts.map(async (concert) => {
            const concertData = new Concert({
                artist: concert.name,
                location: `${concert.venue}, ${concert.city}, ${concert.state}`,
                date: concert.date,
            });

            return concertData.save();
        }));

        res.status(200).send(`${savedConcerts.length} concerts saved successfully!`);
    } catch (error) {
        console.error('Error saving concert:', error);
        res.status(500).send('Error saving concert: ' + error.message);
    }
});

app.post('/register', async (req, res) => {
    const { username, password } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ username, password: hashedPassword });
        await newUser.save();
        res.status(201).send('User registered successfully!');
    }
    catch (error) {
        console.error('Error registering user:', error);
        if (error.code === 11000) {
            res.status(400).send('Username already exists. Please choose another.');
        } else {
            res.status(500).send('Error registering user.');
        }
    }
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(401).send('Invalid username or password.');

        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).send('Invalid username or password.');
        }

        req.session.userId = user._id;
        req.session.username = user.username;
        loggedInUsername = req.session.username;

        res.redirect('/concertFinder');
    } catch (error) {
        console.error('Error logging in:', error);
        res.status(500).send('Error logging in.');
    }
})

function isAuthenticated(req, res, next) {
    if (req.session.userId) {
        next();
    } else {
        res.redirect('/login');
    }
}

app.get('/concertFinder', isAuthenticated, (req, res) => {
    const username = req.session.username;
    console.log(`${username} is logged in`);
    res.sendFile(path.join(__dirname, 'public', 'concertForm.html'));
});

app.get('/downloadSearchResults', async (req, res) => {
    const { artist } = req.query;

    try {
        const query = artist ? { artist: { $regex: artist, $options: 'i' } } : {};
        const concerts = await Concert.find(query);

        if (concerts.length === 0) {
            return res.status(404).send('No results found to download');
        }

        const filePath = path.join(__dirname, 'search_results.txt');
        const fileContent = concerts.map(concert =>
            `${concert.artist} - ${concert.location} on ${concert.date}`
        ).join('\n');

        fs.writeFileSync(filePath, fileContent);

        res.download(filePath, 'search_results.txt', (err) => {
            if (err) {
                console.error('Error sending file:', err);
                res.status(500).send('Error downloading the file.');
            }

            fs.unlinkSync(filePath);
        });
    } catch (error) {
        console.error('Error retrieving concerts for download:', error);
        res.status(500).send('Error retrieving concerts.');
    }
});

app.post('/submit', async (req, res) => {
    const { artist, location } = req.body;
    console.log("BODY RECEIVED:", req.body);
    const username = req.session.username;
    try {
        const concerts = await fetchConcertData(artist, location);

        if (concerts.length > 0) {
            const saveConcertResponse = await fetch(`http://localhost:${Port}/saveConcert`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ artist, location })
            });

            const saveResult = await saveConcertResponse.text();
            console.log(saveResult);
        }

        await renderConcerts(res, username, artist, location, concerts);
    } catch (error) {
        console.error('Error during concert search:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/download', (req, res) => {
    const filePath = path.join(__dirname, 'concert_results.txt');

    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            console.error('File not found:', filePath);
            res.status(404).send('File not found');
            return;
        }

        const fileStream = fs.createReadStream(filePath);

        fileStream.on('error', (error) => {
            console.error('Error reading the file:', error);
            res.status(500).send('Error reading the file');
        });

        res.setHeader('Content-Disposition', 'attachment; filename="concert_results.txt"');
        fileStream.pipe(res);
    });
});

app.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error during logout:', err);
            return res.status(500).send('Error during logout.');
        }
        res.clearCookie('connect.sid');
        loggedInUsername = null;
        res.redirect('/login');
    });
});

app.use((req, res) => {
    res.status(404).send('404:Page Not Found');
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('500: Internal Server Error');
});

app.listen(Port, () => {
    console.log(`Server is running on http://localhost:${Port}`);
});
