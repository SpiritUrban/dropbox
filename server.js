const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { Dropbox } = require('dropbox');
const axios = require('axios');
require('dotenv').config(); // Для загрузки переменных окружения из .env файла

const app = express();
const upload = multer({ dest: 'uploads/' });

// Функция для создания файла .env, если его нет
function createEnvFileIfNotExists() {
    const envFilePath = path.resolve(__dirname, '.env');
    if (!fs.existsSync(envFilePath)) {
        fs.writeFileSync(envFilePath, ''); // Создаем пустой файл .env
    }
}

// Вызов функции для создания .env файла
createEnvFileIfNotExists(); // Убедитесь, что файл существует до загрузки переменных

// Теперь загружаем переменные окружения
require('dotenv').config();

// Dropbox App credentials
const CLIENT_ID = process.env.CLIENT_ID || 'y05vg1oa6gma0vw';
const CLIENT_SECRET = process.env.CLIENT_SECRET || 'kjdnq9xr0uzcih0';
let ACCESS_TOKEN = process.env.ACCESS_TOKEN || ''; // Загружается из переменной окружения

// Функция для записи переменной окружения в .env файл
function updateEnvVar(key, value) {
    const envFilePath = path.resolve(__dirname, '.env');
    const envVars = fs.readFileSync(envFilePath, 'utf8').split('\n');
    const newEnvVars = envVars.map(line => 
        line.startsWith(`${key}=`) ? `${key}=${value}` : line
    );
    if (!newEnvVars.find(line => line.startsWith(`${key}=`))) {
        newEnvVars.push(`${key}=${value}`);
    }
    fs.writeFileSync(envFilePath, newEnvVars.join('\n'));
}

// Функция для обновления ACCESS_TOKEN и сохранения в .env файл
function updateAccessToken(newToken) {
    ACCESS_TOKEN = newToken;
    updateEnvVar('ACCESS_TOKEN', newToken);
    console.log('Access token updated and saved to environment variables.');
}

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
}

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

        updateAccessToken(response.data.access_token); // Сохранение токена в переменную окружения и .env файл
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
