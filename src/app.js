const express = require('express')
const path = require('path')
const mysql = require('mysql')
const bodyParser = require('body-parser')
const session = require('express-session')
const encoder = bodyParser.urlencoded()
const sha256 = require('js-sha256');
const { error } = require('console')
const { redirect } = require('express/lib/response')


require('dotenv').config()

const app = new express()

app.use(session({
    secret: 'placeholder',
    resave: true,
    saveUninitialized: true
}))

const PORT = process.env.PORT

// Database connection
var con = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: "quant",
    timezone: "Asia/Yakutsk"
});

con.connect((err) => {
    if (err) throw err
    else console.log("Connected to MySQL database!")
})

// ExpressJS application
app.set('views', path.join(__dirname, '/views'))
app.set('view engine', 'ejs')
app.use(express.static(__dirname + '/public'));

app.get('/', (req, res) => {
    con.query('SELECT * FROM electives', (err, results, fields) => {
        if (err) throw err
        else {
            results.forEach(element => {
                console.log(element.name)
            })
            con.query('SELECT * FROM articles', [req.params.id], (err, results2, fields) => {
                if (err) throw err
                else {
                    let arts = []
                    results2.forEach(element => {
                        arts.push(element)
                    })
        
                    let data = {
                        session: req.session,
                        electives: results,
                        articles: arts
                    }
                    res.render('index', data)
                }
            })
        }
    })
    
})

app.get('/pa', (req, res) => {
    let data = {
        session: req.session
    }
    res.render('pa', data)
})

app.get('/login', (req, res) => {
    let data = {
        errorMsg: ""
    }
    res.render('login', data) 
})

app.get('/quant/:id', (req, res) => {
    con.query('SELECT * FROM electives WHERE name = ?', [req.params.id], (err, results, fields) => {
        if (err) throw err
        else {
            con.query('SELECT * FROM application WHERE user = ? AND app = ?', [req.session.user_id, req.params.id], (err, results2, fields) => {
                if (err) throw err
                else {
                    let data = {}
                    if (results2.length > 0) {
                        data = {
                            session: req.session,
                            quant: results,
                            qid: req.params.id,
                            accept: 1
                        }
                    } else {
                        data = {
                            session: req.session,
                            quant: results,
                            qid: req.params.id,
                            accept: 0
                        }
                        
                    }
                    res.render('quant', data)
                }
            })
        }
    })
})

app.get('/article/:id', (req, res) => {
    con.query('SELECT * FROM articles WHERE id = ?', [req.params.id], (err, results, fields) => {
        if (err) throw err
        else {
            results.forEach(element => {
                console.log(element.name)
            })

            let data = {
                session: req.session,
                article: results
            }
            res.render('article', data)
        }
    })
})


app.get('/logout', (req, res) => {
    req.session.destroy()
    res.redirect('/')
})

app.get('/admin', (req, res) => {
    res.render('admin')
})


app.post('/login', encoder, (req, res) => {
    let username = req.body.username
    let password = sha256(req.body.password)
    con.query('SELECT * FROM accounts WHERE login = ? AND password = ?', [username, password],(err, results, fields) => {
        if (results.length > 0) {
            req.session.user_id = results[0].login
            req.session.name = results[0].name
            req.session.surname = results[0].surname
            req.session.lastname = results[0].lastname
            req.session.email = results[0].email
            req.session.phone = results[0].phone
            
            res.redirect('/')
        } else {
            let data = {
                errorMsg: "Неправильный логин или пароль!"
            }
            res.render('login', data)
        }
    })
})

app.post('/adminLogin', encoder, (req, res) => {
    let username = req.body.login
    let password = sha256(req.body.password)
    if (username == process.env.ADMIN_LOGIN && password == process.env.ADMIN_PASSWORD) {
        con.query(`SELECT * FROM requests`, (err, results, fields) => {
            con.query(`SELECT * FROM application`, (err, results2, fields) => {
                let data = {
                    results: results,
                    results2: results2
                }
                res.render('adminMenu', data)
            })
        })
        
    } else {
        res.render('admin')
    }
})

app.post('/reqDone/:id', (req, res) => {
    con.query('UPDATE requests SET done = 1 WHERE id =?', [req.params.id], (err, results, fields) => {
        if (err) throw err
        else {
            con.query(`SELECT * FROM requests`, (err, results, fields) => {
                con.query(`SELECT * FROM application`, (err, results2, fields) => {
                    let data = {
                        results: results,
                        results2: results2
                    }
                    res.render('adminMenu', data)
                })
            })
        }
    })
})

app.post('/appDone/:id', (req, res) => {
    con.query('UPDATE application SET done = 1 WHERE id =?', [req.params.id], (err, results, fields) => {
        if (err) throw err
        else {
            res.redirect('/adminMenu')
        }
    })
})

app.get('/adminMenu', (req, res) => {
    con.query(`SELECT * FROM requests`, (err, results, fields) => {
        con.query(`SELECT * FROM application`, (err, results2, fields) => {
            let data = {
                results: results,
                results2: results2
            }
            res.redirect('/adminMenu', data)
        })
    })
})

app.post('/changePA', encoder, (req, res) => {
    let name = req.body.name
    let surname = req.body.surname
    let lastname = req.body.lastname
    let email = req.body.email
    let phone = req.body.phone
    con.query(`UPDATE accounts SET name='${name}', surname='${surname}', lastname='${lastname}', email = '${email}', phone = '${phone}' WHERE login = '${req.session.user_id}'`, (err, results, fields) => {
        if (err) throw err
        else {
            req.session.name = name
            req.session.surname = surname
            req.session.lastname = lastname
            req.session.email = email
            req.session.phone = phone
            res.redirect('/pa')
        }
    })
})

app.post('/requestQuant', encoder, (req, res) => {
    let name = req.body.name
    let surname = req.body.surname
    let lastname = req.body.lastname
    let phone = req.body.phone
    let id = req.body.id
    con.query(`INSERT INTO application (user, name, surname, phone, app) VALUES (?, ?, ?, ?, ?)`, [req.session.user_id, name, surname, phone, id], (err, results, fields) => {
        if (err) throw err
        else {
            req.session.name = name
            req.session.surname = surname
            req.session.lastname = lastname
            req.session.phone = phone
            res.redirect(`/quant/${id}`)
        }
    })
})

app.get('/makeRequest', encoder, (req, res) => {
    let data = {
        session: req.session
    }
    res.render('reqPage', data)
})


app.post('/makeRequestDB', encoder, (req, res) => {
    let title = req.body.title
    let desc = req.body.descr
    let name = req.body.name
    let surname = req.body.surname
    let phone = req.body.phone
    con.query(`INSERT INTO requests (title, descr, name, surname, phone) VALUES (?, ?, ?, ?, ?)`, [title, desc, name, surname, phone], (err, results, fields) => {
        if (err) throw err
        else {
            res.redirect(`/`)
        }
    })
})


app.post('/publishArticle', encoder, (req, res) => {
    let title = req.body.title
    let desc = req.body.desc
    con.query(`INSERT INTO articles (title, descr) VALUES (?, ?);`, [title, desc], (err, results, fields) => {
        if (err) throw err
        else {
            con.query(`SELECT * FROM requests`, (err, results2, fields) => {
                con.query(`SELECT * FROM application`, (err, results3, fields) => {
                    let data = {
                        results: results2,
                        results2: results3
                    }
                    res.render('adminMenu', data)
                })
            })
        }
    })
})

app.post('/removeQuant', encoder, (req, res) => {
    let name = req.body.name
    let id = req.body.id
    con.query(`DELETE FROM application WHERE user = ? AND app = ?`, [req.session.user_id, id], (err, results, fields) => {
        if (err) throw err
        else {
            res.redirect(`/quant/${id}`)
        }
    })
})


app.post('/register', encoder, (req, res) => {
    let username = req.body.username
    let password = sha256(req.body.password)
    let name = req.body.name
    let surname = req.body.surname
    let lastname = req.body.lastname

    if (username && password && name && surname && lastname) {

        con.query('SELECT * FROM accounts WHERE login = ?', [username],(err, results, fields) => {
            if (err) throw err
            if (results.length == 0) {
                con.query('INSERT INTO accounts (login, password, name, surname, lastname) values (?, ?, ?, ?, ?)', [username, password, name, surname, lastname], (err, results, fields) => {
                    if (err) throw err
                    else {
                        req.session.user_id = username
                        req.session.name = name
                        req.session.surname = surname
                        req.session.lastname = lastname
                        req.session.email = ""
                        req.session.phone = ""
                        res.redirect('/')
                    }
                })
            } else {
                let data = {
                    errorMsg: "Пользователь с данным логином уже существует!"
                }
                res.render('login', data)
            }
        })

    } else {
        let data = {
            errorMsg: "Введите значения во все поля!"
        }
        res.render('login', data)
    }
})

app.listen(PORT, () => {
    console.log(`App is running on http://localhost:${PORT}`)
})