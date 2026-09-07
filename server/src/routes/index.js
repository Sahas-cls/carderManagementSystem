"use strict";

const { Router } = require("express");
const factoryRoutes = require("./factoryRoutes");
const weekRoutes = require("./weekRoutes");
const cadreRoutes = require("./cadreRoutes");
const authRoutes = require("./authRoutes");
const userRoutes = require("./userRoutes");
const userRoleRoutes = require("./userRoleRoutes");
const budgetRoutes = require("./budgetRoutes");
const resignationReasonRoutes = require("./resignationReasonRoutes");
const serviceRangeRoutes = require("./serviceRangeRoutes");
const designationRoutes = require("./designationRoutes");
const departmentRoutes = require("./departmentRoutes");
const sectionRoutes = require("./sectionRoutes");
const employeeRoutes = require("./employeeRoutes");

const router = Router();

router.use("/factories", factoryRoutes);
router.use("/weeks", weekRoutes);
router.use("/cadre", cadreRoutes);
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/user-roles", userRoleRoutes);
router.use("/budgets", budgetRoutes);
router.use("/resignation-reasons", resignationReasonRoutes);
router.use("/service-ranges", serviceRangeRoutes);
router.use("/designations", designationRoutes);
router.use("/departments", departmentRoutes);
router.use("/sections", sectionRoutes);
router.use("/employees", employeeRoutes);

module.exports = router;
