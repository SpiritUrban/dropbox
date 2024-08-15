const express = require('express');
const multer = require('multer');
const fs = require('fs');
const { Dropbox } = require('dropbox');
const axios = require('axios');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });

// Dropbox App credentials
const CLIENT_ID = 'y05vg1oa6gma0vw';
const CLIENT_SECRET = 'kjdnq9xr0uzcih0';
let ACCESS_TOKEN = ''; // Должен быть обновлен после получения через авторизацию

// Инициализация Dropbox клиента
function initDropbox() {
    return new Dropbox({ accessToken: ACCESS_TOKEN });
}

// Middleware для проверки авторизации
function checkAuthorization(req, res, next) {
    if (!ACCESS_TOKEN) {
        return res.status(401).send('User not authorized. Please <a href="/auth">authorize</a> the application first.');
    }
    next();
};

// Функция для очистки папки uploads
function clearUploadsFolder() {
    const directory = 'uploads/';

    fs.readdir(directory, (err, files) => {
        if (err) {
            console.error('Error reading uploads directory:', err);
            return;
        }

        for (const file of files) {
            fs.unlink(path.join(directory, file), err => {
                if (err) {
                    console.error('Error deleting file:', err);
                }
            });
        }
    });
}

// Маршрут для инициализации OAuth 2.0 авторизации
app.get('/auth', (req, res) => {
    const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=http://localhost:3000/auth/callback`;
    res.redirect(authUrl);
});

// Маршрут для обработки callback после авторизации
app.get('/auth/callback', async (req, res) => {
    const { code } = req.query;

    try {
        const response = await axios.post('https://api.dropbox.com/oauth2/token', null, {
            params: {
                code: code,
                grant_type: 'authorization_code',
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                redirect_uri: 'http://localhost:3000/auth/callback',
            },
        });

        ACCESS_TOKEN = response.data.access_token;
        console.log('Authorization successful:', response.data);
        res.redirect('/');
    } catch (error) {
        console.error('Error during OAuth 2.0 flow:', error.response ? error.response.data : error.message);
        res.status(500).send('Authorization failed. Please try again. <a href="/auth">Authorize</a>');
    }
});

// Маршрут для загрузки файла
app.post('/upload', upload.single('file'), checkAuthorization, async (req, res) => {
    try {
        const dbx = initDropbox();

        const contents = fs.readFileSync(req.file.path);
        const response = await dbx.filesUpload({ path: '/' + req.file.originalname, contents });

        res.send(`File uploaded successfully: ${response.result.path_lower}`);

        // Удаляем все файлы из папки uploads после успешной загрузки
        clearUploadsFolder();
    } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).send('Error uploading file');
    }
});

// Маршрут для скачивания файла
app.get('/download/:filename', checkAuthorization, async (req, res) => {
    try {
        const dbx = initDropbox();

        const filename = req.params.filename;
        const response = await dbx.filesGetTemporaryLink({ path: '/' + filename });
        res.redirect(response.result.link);
    } catch (error) {
        console.error('Error generating download link:', error);
        res.status(500).send('Error generating download link');
    }
});

// Маршрут для отображения страницы загрузки файла
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'upload.html'));
});

// Маршрут для получения ссылки на изображение
app.get('/get-image-link/:filename', checkAuthorization, async (req, res) => {
    try {
        const dbx = initDropbox();

        const filename = req.params.filename;
        const response = await dbx.filesGetTemporaryLink({ path: '/' + filename });
        const imageUrl = response.result.link; // Ссылка на файл
        res.send(`<img src="${imageUrl}" alt="${filename}">`);
    } catch (error) {
        console.error('Error generating image link:', error);
        res.status(500).send('Error generating image link');
    }
});

app.listen(3000, () => {
    console.log('Server started on http://localhost:3000');
});
