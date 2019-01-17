const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

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
  async deleteItem(parent, args, ctx, info) {
    //TODO: check if user is logged in
    // 1. Get the item details
    const item = await ctx.db.query.item(
      {
        where: { id: args.id }
      },
      `{ id title }`
    );
    // 2. Check if user has permission to delete

    // 3. Delete the item
    return ctx.db.mutation.deleteItem({ where: { id: args.id } }, info);
  },

  async signup(parent, args, ctx, info) {
    args.email = args.email.toLowerCase();

    //hashing password
    args.password = await bcrypt.hash(args.password, 10);

    const user = await ctx.db.mutation.createUser(
      {
        data: {
          ...args,
          permissions: { set: ["USER"] } //because this is talking to an external enum
        }
      },
      info
    );

    //create JWT token
    const token = jwt.sign({ userId: user.id }, process.env.APP_SECRET);

    //set JWT as cookie on response
    ctx.response.cookie("token", token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365 // 1 year cookie
    });

    return user;
  }
};

module.exports = Mutation;
