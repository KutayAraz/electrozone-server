export enum ErrorType {
    USER_NOT_FOUND = 'USER_NOT_FOUND',
    CART_NOT_FOUND = 'CART_NOT_FOUND',
    PRODUCT_NOT_FOUND = 'PRODUCT_NOT_FOUND',
    CART_ITEM_NOT_FOUND = 'CART_ITEM_NOT_FOUND',
    OUT_OF_STOCK = 'OUT_OF_STOCK',
    QUANTITY_LIMIT_EXCEEDED = 'QUANTITY_LIMIT_EXCEEDED',
    STOCK_LIMIT_EXCEEDED = 'STOCK_LIMIT_EXCEEDED',
    PRODUCT_PRICE_CHANGED = 'PRODUCT_PRICE_CHANGED',
    INVALID_INPUT = 'INVALID_INPUT',
    DATABASE_ERROR = 'DATABASE_ERROR',
    CATEGORY_INFO_ERROR = 'CATEGORY_INFO_ERROR',
    TOP_PRODUCTS_ERROR = 'TOP_PRODUCTS_ERROR',
    ORDER_NOT_FOUND = 'ORDER_NOT_FOUND',
    CANCELLATION_PERIOD_ENDED = 'CANCELLATION_PERIOD_ENDED',
    UNAUTHORIZED_ORDER_CANCELLATION = 'UNAUTHORIZED_ORDER_CANCELLATION',
    CATEGORY_NOT_FOUND = 'CATEGORY_NOT_FOUND',
    SUBCATEGORY_NOT_FOUND = 'SUBCATEGORY_NOT_FOUND',
    INVALID_CURRENT_PASSWORD = 'INVALID_CURRENT_PASSWORD',
    INVALID_NEW_PASSWORD = 'INVALID_NEW_PASSWORD',
    PASSWORD_MISMATCH = 'PASSWORD_MISMATCH',
    USER_ALREADY_EXISTS = 'USER_ALREADY_EXISTS',
    INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
    INVALID_TOKEN = 'INVALID_TOKEN',
    LOGOUT_ERROR = 'LOGOUT_ERROR',
    ACCESS_DENIED = 'ACCESS_DENIED',
    INVALID_REFRESH_TOKEN = 'INVALID_REFRESH_TOKEN',
    PASSWORD_UPDATE_FAILED = 'PASSWORD_UPDATE_FAILED',
    AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
    INELIGABLE_REVIEW = 'INELIGABLE_REVIEW',
    UNAUTHORIZED = 'UNAUTHORIZED',
    SESSION_EXPIRED = 'SESSION_EXPIRED',
    FORBIDDEN = "FORBIDDEN",
    INVALID_SESSION = "INVALID_SESSION",
    EMPTY_CART = "EMPTY_CART",
    NO_CHECKOUT_SESSION= "NO_CHECKOUT_SESSION",
    CHECKOUT_SESSION_EXPIRED = "CHECKOUT_SESSION_EXPIRED"
};