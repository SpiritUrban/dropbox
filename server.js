const express = require('express');
const multer = require('multer');
const fs = require('fs');
const { Dropbox } = require('dropbox');

const app = express();
const upload = multer({ dest: 'uploads/' });

// App key
// y05vg1oa6gma0vw

// App secret
// kjdnq9xr0uzcih0

// Инициализация Dropbox клиента
const dbx = new Dropbox({ accessToken: 'sl.B68EQCs1PbOvCHyovGWEbpCWRQHZKiPENhhmTUka8knSBoSspt8SUevmoqihFP5a739ojkkB-4tTj1ystRZFnORYfCZ8eUb-Att8kP0ohflzG0FrBYkOUhgLfsSrRDX3mkErbcbbpSAth3g6ht4ZM98' });

app.post('/upload', upload.single('file'), (req, res) => {
    fs.readFile(req.file.path, (err, contents) => {
        if (err) {
            return res.status(500).send('Error reading file');
        }

        dbx.filesUpload({ path: '/' + req.file.originalname, contents })
            .then((response) => {
                res.send(`File uploaded successfully: ${response.result.path_lower}`);
            })
            .catch((error) => {
                console.error(error);
                res.status(500).send('Error uploading file');
            });
    });
});

app.listen(3000, () => {
    console.log('Server started on http://localhost:3000');
});


app.get('/download/:filename', (req, res) => {
    const filename = req.params.filename;

    dbx.filesGetTemporaryLink({ path: '/' + filename })
        .then((response) => {
            res.redirect(response.result.link);
        })
        .catch((error) => {
            console.error(error);
            res.status(500).send('Error generating download link');
        });
});

const path = require('path');

// Маршрут для отображения страницы загрузки файла
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'upload.html'));
});

app.get('/get-image-link/:filename', (req, res) => {
    const filename = req.params.filename;

    dbx.filesGetTemporaryLink({ path: '/' + filename })
        .then((response) => {
            const imageUrl = response.result.link; // Ссылка на файл
            res.send(`<img src="${imageUrl}" alt="${filename}">`);
        })
        .catch((error) => {
            console.error(error);
            res.status(500).send('Error generating image link');
        });
});

