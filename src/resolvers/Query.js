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
  },

  async order(parent, args, ctx, info) {
    //1. Check if user is logged in
    if (!ctx.request.userId) {
      throw new Error("No logged in user");
    }

    //2. Fetch order from DB
    const order = await ctx.db.query.order({ where: { id: args.id } }, info);
    console.log("order", order);
    if (!order) {
      throw new Error("No order found with this ID");
    }
    //3. Check is user has the permission to view this order
    const isOwner = ctx.request.userId === order.user.id;
    const hasPermission = ctx.request.user.permissions.includes(["ADMIN"]);
    if (!isOwner && !hasPermission) {
      throw new Error("No sufficient priveledge");
    }

    //4. Return order
    return order;
  }
};

module.exports = Query;
