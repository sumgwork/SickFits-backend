const { forwardTo } = require("prisma-binding");

const Query = {
  items: forwardTo("db"), //if query is same as backend query
  item: forwardTo("db"),
  itemsConnection: forwardTo("db"),

  users: forwardTo("db"),

  async me(parents, args, ctx, info) {
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
