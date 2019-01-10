const { forwardTo } = require("prisma-binding");

const Query = {
  items: forwardTo("db") //if query is same as backend query

  //If there is some custom logic involved
  //   async items(parent, args, ctx, info) {
  //     const items = await ctx.db.query.items();
  //     return items;
  //   }
};

module.exports = Query;
