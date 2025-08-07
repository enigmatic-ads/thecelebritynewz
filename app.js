require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 14000;

app.use(express.json());

// Path to posts.json
const POSTS_FILE = path.join(__dirname, 'public', 'posts.json');
const JWT_SECRET = process.env.JWT_SECRET;
// Middleware
app.use((req, res, next) => {
  if (!path.extname(req.path)) {
    const filePath = path.join(__dirname, 'public', req.path + '.html');
    if (fs.existsSync(filePath)) {
      return res.sendFile(filePath);
    }
  }
  next();
});

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

//Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/assets/images');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const imageFileName = 'post' + req.postId + ext;
    cb(null, imageFileName);
  }
});

const upload = multer({ storage });

// API route to get posts.json
app.get("/api/posts", (req, res) => {
    res.sendFile(path.join(__dirname, "public/assets/data/posts.json"));
});

// Serve index page for root
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public/"));
});

// Route for blogs and category pages
app.get(['/blogs', '/category/:slug'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'blogs.html'));
});

app.get("/about", (req, res) => {
    res.sendFile(path.join(__dirname, "public/about.html"));
});

app.get("/contact", (req, res) => {
    res.sendFile(path.join(__dirname, "public/contact.html"));
});

app.get("/privacy-policy", (req, res) => {
    res.sendFile(path.join(__dirname, "public/privacy-policy.html"));
});

app.get("/cookie-policy", (req, res) => {
    res.sendFile(path.join(__dirname, "public/cookie-policy.html"));
});

app.get("/login", (req, res) => {
    res.sendFile(path.join(__dirname, "public/login.html"));
});

// Catch-all for slugs (dynamic post details)
app.get("/:slug", (req, res) => {
    res.sendFile(path.join(__dirname, "public/blog-details.html"));
});

function checkAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Missing token' });

  const token = authHeader.split(' ')[1];
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
}

// Get all blog posts
app.get('/posts', (req, res) => {
  try {
    const data = fs.readFileSync(POSTS_FILE, 'utf-8');
    res.json(JSON.parse(data));
  } catch (err) {
    res.status(500).json({ error: 'Failed to read posts file.' });
  }
});

function generatePostId(req, res, next) {
  try {
    const data = fs.readFileSync(POSTS_FILE, 'utf-8');
    const posts = JSON.parse(data);
    const postId = (parseInt(posts[posts.length - 1]?.id || '0') + 1);
    req.postId = postId;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate post ID' });
  }
}

// Add a new blog post
app.post('/add-post', generatePostId, upload.single('image'),(req, res) => {
  try {
    const slug = slugify(req.body.title);
    const categorySlug = slugify(req.body.category);
    const newPost = {
      id: req.postId,
      date: new Date().toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
      }),
      title: req.body.title,
      summary: req.body.summary,
      content: req.body.content,
      category: req.body.category,
      image: 'assets/images/' + req.file.filename,
      slug,
      categorySlug,
      comments: []
    };

    const data = fs.readFileSync(POSTS_FILE, 'utf-8');
    const posts = JSON.parse(data);

    posts.push(newPost);
    fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2));
    res.json({ status: 'success', id: newPost.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save post.' });
  }
});

app.post('/api/add-comment', (req, res) => {
    const { slug, comment } = req.body;
    console.log(comment)

    try {
      const data = fs.readFileSync(POSTS_FILE, 'utf-8');
      const posts = JSON.parse(data);

      const postIndex = posts.findIndex(p => p.slug === slug);
      if (postIndex === -1) return res.status(404).json({ error: 'Post not found' });

      posts[postIndex].comments.push(comment);

      fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2));
      res.json({ message: 'Comment added successfully' });
    } catch (err) {
      console.error(err);
      res.status(500).json({error: 'Failed to add comment.'});
    }
});


function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim() 
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

app.put('/api/blogs/:id', checkAuth, (req, res) => {
  try {
  const blogId = parseInt(req.params.id, 10);
  const updatedBlog = req.body;

  const data = fs.readFileSync(POSTS_FILE, 'utf-8');
    const posts = JSON.parse(data);
    const index = posts.findIndex(p => p.id == blogId);

    if (index === -1) return res.status(404).send('Blog not found');

    posts[index] = updatedBlog;

    fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2));
    res.json({ status: 'success', id: updatedBlog.id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save post.' });
  }
});

app.delete('/api/blogs/:id', checkAuth, (req, res) => {
  try {
    const blogId = parseInt(req.params.id, 10);

    const data = fs.readFileSync(POSTS_FILE, 'utf-8');
    const posts = JSON.parse(data);

    const index = posts.findIndex(post => post.id == blogId);
    if (index === -1) {
      return res.status(404).json({ error: 'Blog not found' });
    }

    posts.splice(index, 1); // Remove the blog
    fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2));

    res.json({ status: 'success', message: `Blog with ID ${blogId} deleted.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete blog.' });
  }
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  const ADMIN_USERNAME  = process.env.ADMIN_USERNAME;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

  if (username !== ADMIN_USERNAME) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  bcrypt.compare(password, ADMIN_PASSWORD, (err, result) => {
    if (!result) return res.status(401).json({ error: 'Invalid credentials' });

    const JWT_EXPIRY = process.env.JWT_EXPIRY;

    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
    res.json({ token });
  });
});

const tokenBlacklist = new Set();

app.post('/api/logout', checkAuth, (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'No token provided' });

  if(isTokenBlacklisted(token)) {
    return res.status(403).json({ message: 'Token is already blacklisted' });
  }

  tokenBlacklist.add(token);
  res.json({ message: 'Logged out successfully' });
});

// Middleware to check if token is blacklisted
function isTokenBlacklisted(token) {
  return tokenBlacklist.has(token);
}

app.post('/api/add-script', checkAuth, async (req, res) => {
  const { script, pin, position } = req.body;
  const ADD_SCRIPT_KEY = process.env.ADD_SCRIPT_KEY;

  try {
    if (script.startsWith('<script>')) {
      return res.status(403).json({ error: 'Error: Script content should not start with <script> tag.' });
    }

    const isMatch = await bcrypt.compare(pin, ADD_SCRIPT_KEY);

    if (!isMatch) {
      return res.status(403).json({ error: 'Error: Incorrect pin' });
    }

    const indexPath = path.join(__dirname, 'public', 'index.html');
    let indexHtml = fs.readFileSync(indexPath, 'utf-8');

    const scriptWithTag = `\n<script>\n${script}\n</script>\n`;

    if (indexHtml.includes(scriptWithTag)) {
      return res.status(400).json({ error: 'Error: Script already present.' });
    }

    if (position == 'head') {
      indexHtml = indexHtml.replace('</head>', `${scriptWithTag}</head>`);
    } else if (position == 'body') {
      indexHtml = indexHtml.replace('</body>', `${scriptWithTag}<body>`);
    } else {
      return res.status(400).json({ error: 'Error: Invalid position specified.' });
    }

    fs.writeFileSync(indexPath, indexHtml, 'utf-8');

    return res.json({ status: 'success', message: 'Script added successfully.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: 'error', message: 'Failed to update index.html' });
  }
});

app.get('/api/verify-token', checkAuth, (req, res) => {
  res.sendStatus(200);
});

// Start server
app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
});
