const express = require("express");
const app = express();
const { User, Kitten } = require("./db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { JWT_SECRET = "neverTell" } = process.env;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", async (req, res, next) => {
  try {
    res.send(`
      <h1>Welcome to Cyber Kittens!</h1>
      <p>Cats are available at <a href="/kittens/1">/kittens/:id</a></p>
      <p>Create a new cat at <b><code>POST /kittens</code></b> and delete one at <b><code>DELETE /kittens/:id</code></b></p>
      <p>Log in via POST /login or register via POST /register</p>
    `);
  } catch (error) {
    console.error(error);
    next(error);
  }
});

// Verifies token with jwt.verify and sets req.user
// TODO - Create authentication middleware
const setUser = async (req, res, next) => {
  const auth = req.header("Authorization");
  if (!auth) {
    next();
  } else {
    const [, token] = auth.split(" ");
    try {
      const user = jwt.verify(token, JWT_SECRET);
      req.user = user;
      next();
    } catch (error) {
      res.sendStatus(401);
    }
  }
};
// POST /register
// OPTIONAL - takes req.body of {username, password} and creates a new user with the hashed password
app.post("/register", setUser, async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const hashedPw = await bcrypt.hash(password, 10);
    const newUser = User.create({ username, password: hashedPw });
    const token = jwt.sign(username, JWT_SECRET);
    res.status(200).send({ message: "success", token });
  } catch (error) {
    console.log(error);
    next(error);
  }
});

// POST /login
// OPTIONAL - takes req.body of {username, password}, finds user by username, and compares the password with the hashed version from the DB
app.post("/login", setUser, async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ where: { username } });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.sendStatus(401);
    } else {
      const token = jwt.sign(username, JWT_SECRET);
      res.status(200).send({ message: "success", token });
    }
  } catch (error) {
    console.log(error);
    next(error);
  }
});

// GET /kittens/:id
// TODO - takes an id and returns the cat with that id
app.get("/kittens/:id", setUser, async (req, res, next) => {
  if (!req.user) {
    res.sendStatus(401);
  } else {
    try {
      const { id } = req.params;
      const kitten = await Kitten.findByPk(id, { include: { model: User } });
      if (req.user.id !== kitten.ownerId) {
        res.sendStatus(401);
      } else {
        res.status(200).send({
          age: kitten.age,
          color: kitten.color,
          name: kitten.name,
          owner: kitten.user.username,
        });
      }
    } catch (error) {
      console.log(error);
      next(error);
    }
  }
});

// POST /kittens
// TODO - takes req.body of {name, age, color} and creates a new cat with the given name, age, and color
app.post("/kittens", setUser, async (req, res, next) => {
  const { name, age, color } = req.body;
  if (!req.user) {
    res.sendStatus(401);
  } else {
    try {
      const newKitten = await Kitten.create({
        name,
        age,
        color,
        ownerId: req.user.id,
      });
      res.status(201).send({
        age: newKitten.age,
        color: newKitten.color,
        name: newKitten.name,
      });
    } catch (error) {
      console.log(error);
      next(error);
    }
  }
});

// DELETE /kittens/:id
// TODO - takes an id and deletes the cat with that id
app.delete("/kittens/:id", setUser, async (req, res, next) => {
  if (!req.user) {
    res.sendStatus(401);
  } else {
    try {
      const { id } = req.params;
      const kitten = await Kitten.findByPk(id);
      if (req.user.id !== kitten.ownerId) {
        res.sendStatus(401);
      } else {
        await kitten.destroy();
        res.sendStatus(204);
      }
    } catch (error) {
      console.log(error);
      next(error);
    }
  }
});

// error handling middleware, so failed tests receive them
app.use((error, req, res, next) => {
  console.error("SERVER ERROR: ", error);
  if (res.statusCode < 400) res.status(500);
  res.send({ error: error.message, name: error.name, message: error.message });
});

// we export the app, not listening in here, so that we can run tests
module.exports = app;
