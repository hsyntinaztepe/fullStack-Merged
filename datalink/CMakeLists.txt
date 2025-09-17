cmake_minimum_required(VERSION 3.16)
project(DataLinkService LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# MinGW için statik linkleme ayarları
if(MINGW)
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -static-libgcc -static-libstdc++")
    set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} -static")
endif()

# -----------------------------
# gRPC / Protobuf ayarları
# -----------------------------
set(CMAKE_PREFIX_PATH "C:/Users/tinaz/Desktop/grpc/install")
set(gRPC_DIR "C:/Users/tinaz/Desktop/grpc/install/lib/cmake/grpc")
set(Protobuf_DIR "C:/Users/tinaz/Desktop/grpc/install/lib/cmake/protobuf")

find_package(Protobuf REQUIRED PATHS "C:/Users/tinaz/Desktop/grpc/install" NO_DEFAULT_PATH)
find_package(gRPC CONFIG REQUIRED PATHS "C:/Users/tinaz/Desktop/grpc/install" NO_DEFAULT_PATH)

set(PROTOC_EXECUTABLE "C:/Users/tinaz/Desktop/grpc/install/bin/protoc.exe")
set(GRPC_CPP_PLUGIN_EXECUTABLE "C:/Users/tinaz/Desktop/grpc/install/bin/grpc_cpp_plugin.exe")

set(PROTO_SRC_DIR "${CMAKE_CURRENT_SOURCE_DIR}/proto")
set(PROTO_FILES "${PROTO_SRC_DIR}/datalink.proto")
set(GENERATED_DIR "${CMAKE_CURRENT_SOURCE_DIR}/generated")

add_custom_command(
    OUTPUT "${GENERATED_DIR}/datalink.pb.cc" "${GENERATED_DIR}/datalink.pb.h"
           "${GENERATED_DIR}/datalink.grpc.pb.cc" "${GENERATED_DIR}/datalink.grpc.pb.h"
    COMMAND ${PROTOC_EXECUTABLE}
        -I ${PROTO_SRC_DIR}
        --cpp_out=${GENERATED_DIR}
        --grpc_out=${GENERATED_DIR}
        --plugin=protoc-gen-grpc=${GRPC_CPP_PLUGIN_EXECUTABLE}
        ${PROTO_FILES}
    DEPENDS ${PROTO_FILES}
    COMMENT "Running protoc on ${PROTO_FILES}"
    VERBATIM
)

set(GENERATED_SRCS
    ${GENERATED_DIR}/datalink.pb.cc
    ${GENERATED_DIR}/datalink.grpc.pb.cc
)
set(GENERATED_HDRS
    ${GENERATED_DIR}/datalink.pb.h
    ${GENERATED_DIR}/datalink.grpc.pb.h
)

# -----------------------------
# MongoDB C++ driver ayarları
# -----------------------------
add_definitions(-DMONGOCXX_STATIC -DBSONCXX_STATIC -DMONGOC_STATIC -DBSON_STATIC)

set(MONGO_CXX_INSTALL_DIR "C:/msys64/home/tinaz/mongo-cxx-install")
set(MONGO_CXX_INCLUDE_DIR "${MONGO_CXX_INSTALL_DIR}/include")
set(MONGO_CXX_LIB_DIR     "${MONGO_CXX_INSTALL_DIR}/lib")

# Eğer mongo-c-driver ayrı kuruluysa buradan ekle
set(MONGO_C_DRIVER_INCLUDE_DIR "${MONGO_CXX_INSTALL_DIR}/include/mongoc-2.0")
set(BSON_C_DRIVER_INCLUDE_DIR  "${MONGO_CXX_INSTALL_DIR}/include/bson-2.0")
    
link_directories(
    ${MONGO_CXX_LIB_DIR}
    C:/msys64/home/tinaz/mongo-c-driver-install/lib
    C:/msys64/home/tinaz/mongo-cxx-install/lib
)

# -----------------------------
# Executable
# -----------------------------
add_executable(datalink
    ${CMAKE_CURRENT_SOURCE_DIR}/main.cpp
    ${CMAKE_CURRENT_SOURCE_DIR}/datalinkservice.cpp
    ${GENERATED_SRCS}
    ${GENERATED_HDRS}
)

# Include dizinleri
target_include_directories(datalink PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}
    ${PROTO_SRC_DIR}
    ${GENERATED_DIR}
    C:/msys64/home/tinaz/mongo-cxx-install/include
    C:/msys64/home/tinaz/mongo-cxx-install/include/bsoncxx/v_noabi
    C:/msys64/home/tinaz/mongo-cxx-install/include/mongocxx/v_noabi
)

# Link kütüphaneleri
target_link_libraries(datalink PRIVATE
    gRPC::grpc++
    protobuf::libprotobuf
    mongocxx-static
    bsoncxx-static
    mongoc2
    bson2
    zstd
    z
    ws2_32
    secur32
    crypt32
    bcrypt
    ncrypt
    dnsapi
    advapi32
    kernel32
    user32
)

# MinGW ek kütüphaneler
if(MINGW)
    target_link_libraries(datalink PRIVATE
        wsock32
        winmm
    )
endif()
