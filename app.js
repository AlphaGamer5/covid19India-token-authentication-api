const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 3000;
let db = null;
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

//Middleware
app.use(express.json());

//Starting the server and connecting to the database
const serverAndDb = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    app.listen(PORT, () => {
      console.log(`Server started at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.log(`Error: ${error.message}`);
    process.exit(1);
  }
};

serverAndDb();

const makeState = (state) => {
  return {
    stateId: state.state_id,
    stateName: state.state_name,
    population: state.population,
  };
};
const makeDistrict = (district) => {
  return {
    districtId: district.district_id,
    districtName: district.district_name,
    stateId: district.state_id,
    cases: district.cases,
    cured: district.cured,
    active: district.active,
    deaths: district.deaths,
  };
};

const authenticationToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  let token;
  if (authHeader !== undefined) {
    token = authHeader.split(" ")[1];
  }
  if (token === undefined) {
    res.status(401);
    res.send("Invalid JWT Token");
  } else {
    jwt.verify(token, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        res.status(401);
        res.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//API-1: Login a user
app.post("/login/", async (req, res) => {
  console.log("login");
  const { username, password } = req.body;
  const checkUserQuery = `
        SELECT *
        FROM user
        WHERE username = '${username}'
    ;`;

  const user = await db.get(checkUserQuery);
  if (user === undefined) {
    res.status(400);
    res.send("Invalid user");
  } else {
    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (isPasswordCorrect === false) {
      res.status(400);
      res.send("Invalid password");
    } else {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      res.send({ jwtToken });
    }
  }
});

//API-2: GET list of all states
app.get("/states/", authenticationToken, async (req, res) => {
  const query = `
        SELECT *
        FROM state
    `;

  const states = await db.all(query);
  res.send(states.map((state) => makeState(state)));
});

//API-3: GET a state based on id
app.get("/states/:stateId/", authenticationToken, async (req, res) => {
  const { stateId } = req.params;
  const query = `
        SELECT *
        FROM state
        WHERE state_id = ${stateId}
    ;`;

  const state = await db.get(query);
  res.send(makeState(state));
});

//API-4: CREATE a district
app.post("/districts/", authenticationToken, async (req, res) => {
  const { stateId, districtName, cases, cured, active, deaths } = req.body;
  const query = `
        INSERT INTO district(state_id, district_name, cases, cured, active, deaths)
        VALUES (${stateId}, "${districtName}", ${cases}, ${cured}, ${active}, ${deaths})
    ;`;

  const district = await db.run(query);
  res.send("District Successfully Added");
});

//API-5: GET a district based on id
app.get("/districts/:districtId/", authenticationToken, async (req, res) => {
  const { districtId } = req.params;
  const query = `
        SELECT *
        FROM district
        WHERE district_id = ${districtId}
    ;`;

  const district = await db.get(query);
  res.send(makeDistrict(district));
});

//API-6: DELETE a district
app.delete("/districts/:districtId/", authenticationToken, async (req, res) => {
  const { districtId } = req.params;
  const query = `
        DELETE FROM district
        WHERE district_id = ${districtId}
    ;`;

  const district = await db.run(query);
  res.send("District Removed");
});

// API-7: UPDATE a district based on id
app.put("/districts/:districtId/", authenticationToken, async (req, res) => {
  const { districtId } = req.params;
  const { stateId, districtName, cases, cured, active, deaths } = req.body;
  const query = `
        UPDATE district
        SET state_id = ${stateId},
            district_name = "${districtName}",
            cases = ${cases},
            cured = ${cured},
            active = ${active},
            deaths = ${deaths}
        WHERE district_id = ${districtId}
    ;`;

  const district = await db.run(query);
  res.send("District Details Updated");
});

//API-8: Getting the stats for a state
app.get("/states/:stateId/stats/", authenticationToken, async (req, res) => {
  const { stateId } = req.params;
  const query = `
        SELECT
            SUM(cases) AS totalCases,
            SUM(cured) AS totalCured,
            SUM(active) AS totalActive,
            SUM(deaths) AS totalDeaths
        FROM district
        WHERE state_id = ${stateId}
    ;`;

  const stats = await db.get(query);
  res.send(stats);
});

module.exports = app;
