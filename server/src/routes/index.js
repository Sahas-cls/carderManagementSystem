"use strict";

const { Router } = require("express");
const factoryRoutes = require("./factoryRoutes");
const weekRoutes = require("./weekRoutes");
const cadreRoutes = require("./cadreRoutes");
const authRoutes = require("./authRoutes");
const userRoutes = require("./userRoutes");
const userRoleRoutes = require("./userRoleRoutes");
const budgetRoutes = require("./budgetRoutes");

const router = Router();

router.use("/factories", factoryRoutes);
router.use("/weeks", weekRoutes);
router.use("/cadre", cadreRoutes);
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/user-roles", userRoleRoutes);
router.use("/budgets", budgetRoutes);

module.exports = router;
