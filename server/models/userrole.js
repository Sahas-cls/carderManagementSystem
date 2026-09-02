'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class UserRole extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // A user role can be assigned to many users
      UserRole.hasMany(models.User, { foreignKey: 'userRole', as: 'users' });
    }
  }
  UserRole.init({
    roleId: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    userRole: {
      type: DataTypes.STRING,
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'UserRole',
    tableName: 'UserRoles',
    timestamps: true
  });
  return UserRole;
};
