"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // A user can create many factories
      User.hasMany(models.Factory, {
        foreignKey: "createdBy",
        as: "factories",
      });
      // A user can create many weeks
      User.hasMany(models.Week, { foreignKey: "createdBy", as: "weeks" });
      // A user belongs to a user role
      User.belongsTo(models.UserRole, {
        foreignKey: "userRole",
        as: "role",
      });
      // A user is assigned to (at most) one factory for daily data entry
      User.belongsTo(models.Factory, {
        foreignKey: "factoryId",
        as: "factory",
      });
      // A user can create many budgets
      User.hasMany(models.Budget, { foreignKey: "createdBy", as: "budgets" });
    }

    /** Never let the password hash leak out through res.json(user) etc. */
    toJSON() {
      const values = { ...this.get() };
      delete values.password;
      return values;
    }
  }
  User.init(
    {
      userName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      userRole: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "userroles",
          key: "roleId",
        },
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      lastLoginAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      factoryId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "factories",
          key: "id",
        },
      },
    },
    {
      sequelize,
      modelName: "User",
      tableName: "users",
      timestamps: true,
    },
  );
  return User;
};
