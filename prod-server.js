const express = require('express');
const path = require('path');

const app = express();

// Serve static files
app.use(express.static(path.join(__dirname, 'build/client')));

// For all other routes, serve the index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build/client/index.html'), (err) => {
    if (err) {
      // If index.html doesn't exist, create a basic one
      res.set('Content-Type', 'text/html');
      res.send(`
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Bolt</title>
    <script>
      // Redirect to the main app
      window.location.href = '/';
    </script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
      `);
    }
  });
});

const port = process.env.PORT || 5173;
const host = process.env.HOST || '0.0.0.0';

app.listen(port, host, () => {
  console.log(`🚀 Server ready at http://${host}:${port}`);
});