//jshint esversion:6
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const app  = express();
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require("passport-facebook").Strategy;
const findOrCreate = require("mongoose-findorcreate");

app.use(bodyParser.urlencoded({extended:true}));
app.set('view engine', 'ejs');
app.use(express.static(__dirname + "/public"));

app.use(session({
    secret:"Our Little Secret!",
    resave:false,
    saveUninitialized:false,
}));

app.use(passport.initialize());
app.use(passport.session());

main().catch(err => console.log(err));

async function main() {
  await mongoose.connect('mongodb://127.0.0.1:27017/userDB');
};

const userSchema = new mongoose.Schema({
    username:String,
    password:String,
    googleId:String,
    facebookId:String,
    secret:String
});

userSchema.plugin(findOrCreate);

userSchema.plugin(passportLocalMongoose);

const User = mongoose.model("User", userSchema);

const LocalStrategy = require('passport-local');
passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  done(null, user);
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_ID,
    clientSecret: process.env.FACEBOOK_SECRET,
    callbackURL: "http://localhost:3000/auth/facebook/secrets"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ facebookId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));


app.get("/", function(req, res) {
    res.render("home.ejs");
});

app.get("/auth/google",
  passport.authenticate("google", { scope: ['profile'] })
  );
  app.get("/auth/google/secrets", 
  passport.authenticate("google", { failureRedirect: "/login" }),
  function(req, res) {
    console.log("Signed in successfully!");
    res.redirect("/secrets");
  });

  app.get("/auth/facebook",
  passport.authenticate("facebook"));

  app.get("/auth/facebook/secrets",
  passport.authenticate("facebook", { failureRedirect: "/login" }),
  function(req, res) {
    console.log("Signed in successfully!");
    res.redirect("/secrets");
  });

app.get("/login", function(req, res){
    res.render("login.ejs");
});

app.get("/register", function(req, res){
    res.render("register.ejs");
});

app.get("/secrets", function(req, res) {
 findSecrets(); 
 async function findSecrets() {
    try {
      const foundUser = await User.find({"secret": {$ne:true}})
      if(foundUser) {
        res.render("secrets.ejs", {userWithSecrets: foundUser});
      }
    }catch (err) {
        console.log(err);
    }
 }
});

app.get('/logout', function (req, res, next) {
    req.logout(function (err) {
        if (err) {
            return next(err);
        }
        res.redirect('/');
        console.log('USER NOW LOGGED OUT');
    });
});

app.get("/submit", function(req,res) {
    if(req.isAuthenticated()) {
        res.render("submit");
    } else {
        console.log("User does not exist");
        res.redirect("/login");
    }
});

app.post("/submit", function(req, res )  {
    const submittedSecret = req.body.secret;
    find();
    async function find() {
        try{
        const foundUser = await User.findById(req.user._id)
        if(foundUser) {
            foundUser.secret = submittedSecret;
            await foundUser.save();
            res.redirect("/secrets");
        }
        }catch(err) {
            console.log(err);
        }
    }
    
});

app.post("/register", function(req, res ){
    registerUser();
    async function registerUser () {
        try{
            console.log('[ ' + req.body.username + ' ]' + ' is now registered')
        await User.register(
        { username: req.body.username },
          req.body.password,
          function (err, user) {
            if (err) {
                console.log(err);
                res.redirect('/register');
            } else {
                passport.authenticate('local')(req, res, function () {
                    res.redirect('/secrets');
                });
            }
        }
    );
         }catch(err) {
            res.send(err);
         }
        }
    })

    app.post("/login", function (req, res) {
        //passport version
        const user = new User({
            username: req.body.username,
            password: req.body.password,
        });
        console.log('[ ' + req.body.username + ' ]' + ' is currently logged in');
        req.login(user, function (err) {
            if (err) {
                return next(err);
            } else {
                passport.authenticate('local')(req, res, function () {
                    res.redirect('/secrets');
                });
            }
        });
    });

 





app.listen(3000, function(){
    console.log("Server running on port 3000!");
});