const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { randomBytes } = require("crypto"); //library provided by node
const { transport, makeANiceEmail } = require("../mail");
const { hasPermission } = require("../utils");

const Mutation = {
  async createItem(parent, args, ctx, info) {
    //Checking if user is logged in
    const userId = ctx.request.userId;
    if (!userId) {
      throw new Error("User not logged in");
    }

    const item = await ctx.db.mutation.createItem(
      {
        data: {
          user: {
            //This is how relationship is created
            connect: {
              id: userId
            }
          },
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
    // 2. Check if user has permission to delete or owns the items
    const ownsItem = item.user === ctx.request.userId;
    const isAllowed = ctx.request.user.permissions.some(permission =>
      ["ADMIN", "ITEMDELETE"].includes(permission)
    );
    if (!ownsItem && !isAllowed) {
      throw new Error("You don't have permissions to do that!");
    }

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
  },

  async signin(parent, { email, password }, ctx, info) {
    // 1. Check if email is present in DB
    const user = await ctx.db.query.user({
      where: { email }
    });
    if (!user) {
      throw new Error("No user found for this email id");
    }

    //2. Check if the password is matching
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      throw new Error("Incorrect password");
    }

    //3. Sign in with a new JWT token
    const token = jwt.sign({ userId: user.id }, process.env.APP_SECRET);
    //4. Set the token in response
    ctx.response.cookie("token", token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365 // 1 year cookie
    });
    //5. Return the user
    return user;
  },

  signout(parent, args, ctx, info) {
    ctx.response.clearCookie("token");
    return { message: "Logged out" };
  },

  async requestReset(parent, args, ctx, info) {
    // 1. Check if this is a real user
    const user = await ctx.db.query.user({
      where: { email: args.email }
    });
    if (!user) {
      throw new Error(`No user found for ${args.email}`);
    }

    // 2. Set the reset token fields on that user
    const resetToken = randomBytes(20).toString("hex");
    const resetTokenExpiry = Date.now() + 60 * 60 * 1000; //1 hour

    const res = await ctx.db.mutation.updateUser({
      where: { email: args.email },
      data: { resetToken, resetTokenExpiry }
    });

    // 3. Email them the reset token
    const mailRes = await transport.sendMail({
      from: "info@SGShop.com",
      to: user.email,
      subject: "Your password reset link",
      html: makeANiceEmail(
        `Your password reset token is here - \n\n 
        <a href="${
          process.env.FRONTEND_URL
        }/resetPassword?token=${resetToken}">Click here.</a>
        `
      )
    });

    //4. Response
    return { message: "token sent" };
  },

  async resetPassword(parent, args, ctx, info) {
    // 1. Check if the passwords match
    if (args.password !== args.confirmPassword) {
      throw new Error("Passwords don't match");
    }
    // 2. Get if resetToken is present for that user
    // 3. Check if the reset token is still valid (not expired)

    //We can't query user here with token fields since they are not unique in data model
    //So rather we can query for users and then take the first object of array returned
    const [user] = await ctx.db.query.users({
      where: {
        resetToken: args.resetToken,
        resetTokenExpiry_gte: Date.now() - 60 * 60 * 1000
      }
    });
    if (!user) {
      throw new Error("This token is either invalid or expired");
    }

    // 4. Hash the new password
    const password = await bcrypt.hash(args.password, 10);

    // 5. Update password and clear reset token fields
    const updatedUser = await ctx.db.mutation.updateUser({
      where: { email: user.email },
      data: {
        resetToken: null,
        resetTokenExpiry: null,
        password
      }
    });

    // 6. generate JWT
    const token = jwt.sign({ userId: updatedUser.id }, process.env.APP_SECRET);
    // 7. set JWT to response cookie
    ctx.response.cookie("token", token, {
      httpOnly: true,
      maxAge: 365 * 24 * 60 * 60 * 1000 //1 year
    });
    // 8. return user
    return updatedUser;
  },

  async updatePermissions(parent, args, ctx, info) {
    //1. Check if user is logged in
    if (!ctx.request.userId) {
      throw new Error("User not logged in!");
    }
    //2. Query the current user
    const user = ctx.request.user;
    //3. Check if user has permissions to update
    hasPermission(user, ["ADMIN", "PERMISSIONUPDATE"]);
    //4. Update the permissions
    return ctx.db.mutation.updateUser(
      {
        data: {
          permissions: {
            set: args.permissions // to be done this way because permissions is an enum
          }
        },
        where: {
          id: args.userId
        }
      },
      info
    );
  },

  async addToCart(parent, args, ctx, info) {
    //1. Check if user is logged in
    const userId = ctx.request.userId;
    if (!userId) {
      throw new Error("User not logged in!");
    }
    //2. Get user's current cart
    const [existingCartItem] = await ctx.db.query.cartItems({
      where: {
        user: { id: userId },
        item: { id: args.id }
      }
    });

    //3. Check if the item is already in cart, if yes, inc by 1
    if (existingCartItem) {
      return ctx.db.mutation.updateCartItem({
        where: {
          id: existingCartItem.id
        },
        data: {
          count: existingCartItem.count + 1
        }
      });
    }
    //4. If not, add new item to cart
    return ctx.db.mutation.createCartItem({
      data: {
        user: { connect: { id: userId } },
        item: { connect: { id: args.id } }
      }
    });
    //5. Return cartitem
  },

  async removeFromCart(parent, args, ctx, info) {
    //1. Get item from the cart
    const cartItem = await ctx.db.query.cartItem(
      {
        where: {
          id: args.id
        }
      },
      `{id, user {id}}`
    );
    if (!cartItem) {
      throw new Error("Item does not exist in cart");
    }
    //2. Check if user owns this item
    // if (cartItem.user.id !== ctx.request.userId) {
    //   throw new Error("You are not permitted to do that");
    // }

    //3. remove the item
    return ctx.db.mutation.deleteCartItem(
      {
        where: {
          id: args.id
        }
      },
      info
    );
  }
};

module.exports = Mutation;
