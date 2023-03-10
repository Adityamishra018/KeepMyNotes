import express from "express"
import { MongoClient } from "mongodb"
import dotenv from "dotenv"
import path from "path"
import { AuthApp, authorized } from "./auth.js"
import bodyParser from "body-parser"

dotenv.config()

const app = express()

const mongoClient = new MongoClient(process.env.MONGO_URL)

const notes = mongoClient.db("Data").collection("notes")
const counters = mongoClient.db("Data").collection("counters")
counters.getNextNoteId = async function () {
    let value = 0;
    await this.findOneAndUpdate({ "_id": "notes" }, { $inc: { val: 1 } }).then((doc) => {
        value = doc.value.val
    })
    return value;
}

app.set("views", path.resolve("./views"))
app.set("view engine", "ejs")

app.use(express.static("."))
app.use(AuthApp)

app.get('/', (req, res) => {
    if (!req.headers.cookie)
        res.render('login',{msg:""})
    else
        res.redirect('home')
})

app.get('/login', authorized,(req, res) => {
    res.redirect("/home")
})

app.get('/home', authorized, (req, res) => {
    res.render("home", { user: req.user, notes: req.notes})
})

app.get('/add', authorized, (req, res) => {
    res.render("add", { user: req.user })
})

app.post('/add', authorized, bodyParser.urlencoded({ extended: false }), async (req, res) => {
    if (req.body.title && req.body.desc) {
        await notes.insertOne({
            id: await counters.getNextNoteId(),
            title: req.body.title,
            desc: req.body.desc,
            username: req.user.username
        }).then(() => {
            res.redirect("/home")
        }).catch(err => {
            res.status(500).send("Internal server error")
        })
    }
    else {
        res.redirect("add")
    }
})

app.get('/edit/:username/:id',authorized,async (req, res) => {
    if(req.user.username === req.params.username){
        let note = await notes.findOne({username : req.user.username, id : parseInt(req.params.id)})
        res.render("edit", { user: req.user ,note : note})
    }
})  

app.post('/edit',authorized,bodyParser.urlencoded({extended:false}),async (req,res)=>{
    if(req.body.title && req.body.desc){
        await notes.updateOne({id: parseInt(req.body.id)},{$set : {title : req.body.title, desc : req.body.desc}}).then((doc)=>{
            res.redirect(`/edit/${req.user.username}/${req.body.id}`)
        }).catch(()=>{
            res.redirect("/home")
        })
    }   
    else{
        res.redirect("/home")
    }
})

app.post('/delete/:id',authorized,async (req,res)=>{
    await notes.deleteOne({username : req.user.username,id : parseInt(req.params.id)}).then((ret)=>{
        if(ret.deletedCount === 1){
            res.status(200).redirect("/home")
        }
        else{
            res.status(500).send("Something went wrong !")
        }
    })
})

app.listen(3000)
export default app