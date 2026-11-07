const express = require('express');
const path = require('path');
const apiRouter = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '100kb' }));
app.use('/api', apiRouter);
app.use('/vendor/chart.js', express.static(path.join(__dirname, 'node_modules', 'chart.js', 'dist')));
app.use('/vendor/leaflet', express.static(path.join(__dirname, 'node_modules', 'leaflet', 'dist')));
app.use(express.static(path.join(__dirname, 'public')));

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(400).json({ error: err.message || 'Error en el cálculo' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🌪️  Tornado Expo listo en http://localhost:${PORT}`);
  });
}

module.exports = app;
