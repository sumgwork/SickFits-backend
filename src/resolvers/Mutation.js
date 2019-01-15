const Mutation = {
  async createItem(parent, args, ctx, info) {
    //TODO: Check if user is logged in

    const item = await ctx.db.mutation.createItem(
      {
        data: {
          ...args
        }
      },
      info
    );

    return item;
  },
  updateItem(parent, args, ctx, info) {
    //TODO: Check if user is logged in
    const updates = { ...args };
    delete updates.id;

    return ctx.db.mutation.updateItem(
      {
        data: updates,
        where: { id: args.id }
      },
      info
    );
  },
  deleteItem(parent, args, ctx, info) {
    //TODO: check if user is logged in
    return ctx.db.mutation.deleteItem({ where: { id: args.id } }, info);
  }
};

module.exports = Mutation;
