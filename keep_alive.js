import express from 'express';

const app = express();

app.get('/', (req, res) => {
  res.send('Le bot est actif.');
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Serveur actif sur le port ${port}.`);
});
