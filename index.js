const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const dbPath = path.join(__dirname, "expense.db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const app = express();
app.use(express.json());
app.use(cors());


let db;

const initialDBAndServer = async () => {
    try {
        db = await open({
            filename: dbPath,
            driver: sqlite3.Database
        });
        app.listen(4000, () => {
            console.log("My server is running at 4000 port");
        })
    }
    catch (e) {
        console.log(`error message${e}`);
        process.exit(1);
    }
}

initialDBAndServer();

const authorizationUser = (request, response, next) => {
    let jwtToken;
    const AuthToken = request.headers["authorization"]
    if (AuthToken !== undefined) {
        jwtToken = AuthToken.split(" ")[1];
    }
    if (jwtToken === undefined) {
        response.status(401);
        response.send("Invalid Access Token");
    } else {
        jwt.verify(jwtToken, 'SCRECT_CODE', async (error, payload) => {
            if (error) {
                response.status(401);
                response.send("Invalid Access Token");
            } else {
                request.username = payload.username;
                next()
            }
        })
    }
}

    app.post('/signup', async (request, response) => {
        const { name, email, password, created_at } = request.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const userQuery = `
        SELECT * FROM users WHERE name = '${name}';
    `;
        const dbUser = await db.get(userQuery);
        if (dbUser === undefined) {
            const createInsertUser = `
            INSERT INTO users 
                (name, email,password,created_at)
            VALUES(
                '${name}',
                '${email}',
                '${hashedPassword}',
                '${created_at}'
            );
        `;
            const newUserAdded = await db.run(createInsertUser);
            const newUserId = newUserAdded.lastID;
            response.send({ user_id: newUserId });
        }
        else {
            response.status(400);
            response.send({alreadyExist:"User already Exist"});
        }
    })

    app.get("/users/", async (request, response) => {
        const presentDB = `SELECT * FROM users;`;
        const dbPresent = await db.all(presentDB);
        response.send(dbPresent);
    })

    app.post("/login", async (request, response) => {
        const { name, password } = request.body;
        const isPresent = `SELECT * FROM users WHERE name = '${name}';`;
        const isDB = await db.get(isPresent);
        if (isDB === undefined) {
            response.status(400);
            response.send({error_mes:"Invalid User"});
        } else {
            const isPassword = await bcrypt.compare(password, isDB.password);
            if (isPassword) {
                const payload = { username: name }
                const jwtToken = jwt.sign(payload, "SCRECT_CODE");
                response.send({ jwtToken });
            } else {
                response.status(400);
                response.send({error_mes:"Invalid Password"});
            }
        }
    })

    app.post("/expenses",authorizationUser, async (request, response) => {
        const { title, amount, category, date, payment_method} = request.body;
        const username = request.username;
        const loginPerson = `SELECT * FROM users WHERE name='${username}';`;
        const person = await db.get(loginPerson);
        const {id} = person;
        const insertExpense = `
        INSERT INTO expense 
            (title,amount,category,date,payment_method,user_id)
        VALUES (
            '${title}',
            ${amount},
            '${category}',
            '${date}',
            '${payment_method}',
            ${id}
        );
    ` ;
        await db.run(insertExpense);
        response.send({message: "new Expenses Added" });
    })

    app.get("/expenses",authorizationUser, async (request, response) => {
        const {username} = request
        const userIdDetails = `SELECT * FROM users WHERE name = '${username}';`;
        const userIdDB = await db.get(userIdDetails)
        const {id} = userIdDB
        const expensesList = `SELECT * FROM expense WHERE user_id = ${id};`;
        const expense = await db.all(expensesList);
        response.send(expense)
    })

    app.put("/expenses/:id",authorizationUser,async (request,response) => {
        const {id} = request.params;
        const {title,amount,category,date,payment_method} = request.body;
        const updatedData = `
            UPDATE expense 
                SET 
                    title ='${title}',
                    amount = ${amount},
                    category = '${category}',
                    date = '${date}',
                    payment_method = '${payment_method}'
                
            WHERE id = ${id};
        `;
        await db.run(updatedData);
        response.send("Updated Successfully");
    })

    app.delete("/expenses/:id", authorizationUser, async (request,response) => {
        const {id} = request.params;
        const deleteItem = `
            DELETE FROM expense WHERE id = ${id};
        `;
        await db.run(deleteItem);
        response.send({message:"Deleted Successfully"});
    })