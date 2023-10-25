const express = require('express');
const bodyParser = require('body-parser');
const webpush = require('web-push');

const app = express();
app.use(express.static('public'));
const port = 3000;

// Para armazenar os endpoints dos usuários
let subscriptions = [];

// Configuração do web-push
const vapidKeys = webpush.generateVAPIDKeys();
webpush.setVapidDetails(
  'mailto:miguelkallemback.seven@gmail.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

app.use(bodyParser.json());

// Rota para registrar um novo endpoint
app.post('/register', (req, res) => {
  const subscription = req.body;
  subscriptions.push(subscription);
  res.status(201).send({});
});

// Rota para exibir o painel
app.get('/panel', (req, res) => {
  res.send(`
    <form action="/send-notification" method="POST">
      <textarea name="message" placeholder="Digite sua mensagem"></textarea>
      <button type="submit">Enviar Notificação!</button>
    </form>
  `);
});

// Rota para enviar a notificação
app.post('/send-notification', (req, res) => {
  const message = req.body.message;
  subscriptions.forEach(sub => {
    webpush.sendNotification(sub, message);
  });
  res.send('Notificação enviada!');
});

app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
