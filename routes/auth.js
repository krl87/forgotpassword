var express = require('express');
var router = express.Router();

// add auth package refs
var passport = require('passport');
var mongoose = require('mongoose');
// forgot password packages
var nodemailer = require('nodemailer');
var smtpTransport = require('nodemailer-smtp-transport');

var async = require('async');
//part of node library
var crypto = require('crypto');
var flash = require('connect-flash');
var Account = require('../models/account');
var configDb = require('../config/db.js');


passport.serializeUser(function(user, done) {
    done(null, user.id);
});

passport.deserializeUser(function(id, done) {
    Account.findById(id, function(err, user) {
        done(err, user);
    });
});



// GET login - show login form
router.get('/login', function(req, res, next) {
    // store the session messages in a local variable
    var messages = req.session.messages || [];

    // clear the session messages
    req.session.messages = [];

    // check if user is already logged in
    if (req.isAuthenticated()) {
        res.redirect('/auth/welcome');
    }
    else {
        // show the login page and pass in any messages we may have
        res.render('auth/login', {
            title: 'Login',
            user: req.user,
            messages: messages
        });
    }

});

// POST login - validate user

 router.post('/login', passport.authenticate('local', {
    successRedirect: '/auth/welcome',
    failureRedirect: '/auth/login',
    failureMessage: 'Invalid Login'
    //failureFlash: true
}));

// GET register - show registration form
router.get('/register', function(req, res, next) {
   res.render('auth/register', {
    title: 'Register'
   });
});

// GET welcome - show welome page for authenticated users
router.get('/welcome', isLoggedIn, function(req, res, next) {
   res.render('auth/welcome', {
       title: 'Welcome',
       user: req.user
   });
});

// POST register - save new user
router.post('/register', function(req, res, next) {
    /* Try to create a new account using our Account model & the form values
    If we get an error display the register form again
    If registration works, store the user and show the articles main page */
    Account.register(new Account({ username: req.body.username, 
        //add email
        email:req.body.email }), 
        req.body.password, function(err, account) {
        if (err) {
           return res.render('auth/register', { title: 'Register' });
        }
        else {
            /*req.login(account, function(err) {
                res.redirect('/articles');
            });*/
            res.redirect('/auth/login');
        }
    });
});

//create forgot password route
router.get('/forgot', function(req, res, next){
    var messages = req.session.messages || [];

    // clear the session messages
    req.session.messages = [];

    res.render('auth/forgot', {
        title: 'Recover Password',
        user: req.user,
        messages: messages
    });
});



//email out new password
router.post('/forgot', function(req, res, next){
    async.waterfall([
        function(done) {
            crypto.randomBytes(20, function(err, buf) {
                var token = buf.toString('hex');
                done(err, token);
            });
        },
        //check if email is in the system, if not return to forgot password
        function(token, done) {
            Account.findOne({ email: req.body.email }, function(err, user) {
                if (!user) {
                    req.flash('error', 'No Account with that email address exists.');
                    return res.redirect('/forgot');
                }

                //email found, reset password - link live for 1 hour

                user.resetPasswordToken = token;
                user.resetPasswordExpires = Date.now() + 3600000;

                user.save(function (err) {
                    done(err, token, user);
                });
            });
        },


        function(token, user, done) {
            var options = {
                service: 'SendGrid',
                auth: {
                    user: 'comp2106',
                    pass: 'students16'
                }
            };
            var transporter = nodemailer.createTransport(smtpTransport(options))

            var mailOptions = {
                to: user.email,
                from: 'passwordrest@comp2106.com',
                subject: 'Node.js Password Reset',
                text: 'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
                'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
                'http://' + req.headers.host + '/reset/' + token + '\n\n' +
                'If you did not request this, please ignore this email and your password will remain unchanged.\n'
            };
            transporter.sendMail(mailOptions, function(err){
                req.flash('info', 'An e-mail has been sent to ' + user.email + ' with further instructions.');
                done(err, 'done');
            });
        }
    ], function(err){
        if (err) return next(err);
        res.redirect('/forgot');
    });
});

//reset route
// router.get

// GET logout
router.get('/logout', function(req, res, next) {
    // we can use either of these
    //req.session.destroy();
    req.logout();
    res.redirect('/');
});

// auth check
function isLoggedIn(req, res, next) {

    // is the user authenticated?
    if (req.isAuthenticated()) {
        return next();
    }
    else {
        res.redirect('/auth/login');
    }
}

// make this public
module.exports = router, passport;
