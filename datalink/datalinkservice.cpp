#include "datalinkservice.h"
#include <fstream>
#include <sstream>
#include <iostream>

std::vector<std::string> DataLinkServiceImpl::readDataLinkFile(const std::string &filename)
{
    std::vector<std::string> lines;
    std::ifstream file(filename);
    std::string line;

    if (!file.is_open())
    {
        std::cerr << "Error: Could not open file " << filename << std::endl;
        return lines;
    }

    while (std::getline(file, line))
    {
        lines.push_back(line);
    }
    return lines;
}

grpc::Status DataLinkServiceImpl::GetDataLinkMessages(grpc::ServerContext *context,
                                                      const datalink::DataLinkRequest *request,
                                                      datalink::DataLinkResponse *response)
{
    auto lines = readDataLinkFile("datalink_data.txt");

    if (lines.empty())
    {
        std::cout << "No data found or file could not be read." << std::endl;
        return grpc::Status(grpc::StatusCode::NOT_FOUND, "DataLink messages file not found");
    }

    for (const auto &line : lines)
    {
        std::istringstream iss(line);
        std::string id, from_part, from, to_part, to, text_part, text;

        // Format: MSG001, FROM: HQ, TO: UNIT1, TEXT: "Proceed North"
        if (std::getline(iss, id, ','))
        {
            // FROM kısmını parse et
            if (std::getline(iss, from_part, ','))
            {
                size_t colon_pos = from_part.find(':');
                if (colon_pos != std::string::npos)
                {
                    from = from_part.substr(colon_pos + 1);
                }
            }

            // TO kısmını parse et
            if (std::getline(iss, to_part, ','))
            {
                size_t colon_pos = to_part.find(':');
                if (colon_pos != std::string::npos)
                {
                    to = to_part.substr(colon_pos + 1);
                }
            }

            // TEXT kısmını parse et (kalan kısmın hepsi)
            if (std::getline(iss, text_part))
            {
                size_t colon_pos = text_part.find(':');
                if (colon_pos != std::string::npos)
                {
                    text = text_part.substr(colon_pos + 1);
                    // Tırnak işaretlerini ve boşlukları temizle
                    text.erase(0, text.find_first_not_of(" \t\""));
                    text.erase(text.find_last_not_of(" \t\"") + 1);
                }
            }

            // Tüm alanların boşluklarını temizle
            id.erase(0, id.find_first_not_of(" \t"));
            id.erase(id.find_last_not_of(" \t") + 1);
            from.erase(0, from.find_first_not_of(" \t"));
            from.erase(from.find_last_not_of(" \t") + 1);
            to.erase(0, to.find_first_not_of(" \t"));
            to.erase(to.find_last_not_of(" \t") + 1);

            // Response'a mesajı ekle
            auto *message = response->add_messages();
            message->set_id(id);
            message->set_from(from);
            message->set_to(to);
            message->set_text(text);
        }
    }

    response->set_total_count(response->messages_size());

    std::cout << "Loaded DataLink Messages:" << std::endl;
    for (const auto &line : lines)
    {
        std::cout << line << std::endl;
    }
    std::cout << "Total " << response->messages_size() << " messages processed." << std::endl;

    return grpc::Status::OK;
}