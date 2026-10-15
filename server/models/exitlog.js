"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  // Append-only audit trail for employeeexits - see migration
  // 20261015000000-create-exit-logs.js. No associations on purpose: it must
  // survive the deletion of the employee/exit it records.
  class ExitLog extends Model {}
  ExitLog.init(
    {
      action: { type: DataTypes.STRING(40), allowNull: false },
      exitId: { type: DataTypes.INTEGER, allowNull: true },
      employeeId: { type: DataTypes.INTEGER, allowNull: true },
      epf: { type: DataTypes.STRING, allowNull: true },
      employeeName: { type: DataTypes.STRING, allowNull: true },
      batchId: { type: DataTypes.UUID, allowNull: true },
      snapshot: { type: DataTypes.JSON, allowNull: true },
    },
    {
      sequelize,
      modelName: "ExitLog",
      tableName: "exitlogs",
      timestamps: true,
      updatedAt: false,
    },
  );
  return ExitLog;
};
