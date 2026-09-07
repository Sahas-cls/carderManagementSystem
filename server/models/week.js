"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Week extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // A week is created by a user
      Week.belongsTo(models.User, { foreignKey: "createdBy", as: "creator" });

      // A week has many records across the carder tables
      Week.hasMany(models.PlannedCarder, {
        foreignKey: "weekId",
        as: "plannedCarders",
      });
      Week.hasMany(models.AllocatedActualCarder, {
        foreignKey: "weekId",
        as: "allocatedActualCarders",
      });
      Week.hasMany(models.ShortageCarder, {
        foreignKey: "weekId",
        as: "shortageCarders",
      });
      Week.hasMany(models.AllocatedCurrentCarder, {
        foreignKey: "weekId",
        as: "allocatedCurrentCarders",
      });
      Week.hasMany(models.AbsenteeismCarder, {
        foreignKey: "weekId",
        as: "absenteeismCarders",
      });
      Week.hasMany(models.PresentCarder, {
        foreignKey: "weekId",
        as: "presentCarders",
      });
      Week.hasMany(models.NewRecruitCarder, {
        foreignKey: "weekId",
        as: "newRecruitCarder",
      });
      Week.hasMany(models.ResignedCarder, {
        foreignKey: "weekId",
        as: "resignedCarder",
      });
      Week.hasMany(models.NetCarder, {
        foreignKey: "weekId",
        as: "netCarder",
      });
      Week.hasMany(models.TrainingCenter, {
        foreignKey: "weekId",
        as: "trainingCenters",
      });
    }
  }
  Week.init(
    {
      week: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      createdBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
      },
    },
    {
      sequelize,
      modelName: "Week",
      tableName: "weeks",
      timestamps: true,
    },
  );
  return Week;
};
