const { forwardTo } = require("prisma-binding");
const { hasPermission } = require("../utils");

const Query = {
  items: forwardTo("db"), //if query is same as backend query
  item: forwardTo("db"),
  itemsConnection: forwardTo("db"),

  async users(parent, args, ctx, info) {
    //1. Check if user is logged in
    if (!ctx.request.userId) {
      throw new Error("No logged in user");
    }
    // 2. Check if user has required permissions to fetch list of users
    hasPermission(ctx.request.user, ["ADMIN", "PERMISSIONUPDATE"]);
    //3. return users
    return ctx.db.query.users({}, info);
  },

  async me(parent, args, ctx, info) {
    const { userId } = ctx.request;
    if (!userId) {
      return null;
    }
    return await ctx.db.query.user(
      {
        where: { id: userId }
      },
      info
    );
  }
};

module.exports = Query;
